import crowdin, {
  Credentials,
  SourceFilesModel,
} from "@crowdin/crowdin-api-client";
import { MongoClient, Collection } from "mongodb";
import _ from 'lodash'
import * as dotenv from "dotenv";
dotenv.config();

const projectId = Number(process.env.projectId!);
const targetLanguages = ["zh-CN", "es-ES"];
// credentials
const credentials: Credentials = {
  token: process.env.token!,
  //   organization: 'organizationName' // optional
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
const dbName = "crowdinConflux"
const languageTranslation = "languageTranslation"
const translationApproval = "translationApproval"
const sourceString = "sourceString"

const limit = 500

async function insertDocument(collection: Collection, obj: any, attrs: string[]) {
  const existed = await collection.findOne(_.pick(obj, attrs));
  if (existed) {
    console.log(`item already exists with ${JSON.stringify(_.pick(obj, attrs))})`)
    return
  }
  await collection.insertOne(obj);
}

// initialization of crowdin client
const { stringTranslationsApi, sourceStringsApi, projectsGroupsApi, labelsApi } =
  new crowdin(credentials);

async function listLanguageTranslations(offset: number, targetLanguageId: string) {
  const languageTranslations = await stringTranslationsApi.listLanguageTranslations(
    projectId,
    targetLanguageId,
    {
      limit,
      offset,
    }
  );
  return languageTranslations.data.map((item)=>item.data);
}

async function listTranslationApprovals(offset: number, languageId: string) {
  const translationApprovals = await stringTranslationsApi.listTranslationApprovals(projectId, {
    languageId,
    excludeLabelIds: "2",
    limit,
    offset,
  })
  return translationApprovals.data.map((item)=>item.data);
}

async function listSourceStrings(offset: number) {
  const sourceStrings = await sourceStringsApi.listProjectStrings(projectId, {
    offset,
    limit,
  })
  return sourceStrings.data.map((item)=>item.data);
}

async function insertItems(collection: Collection, f: ((offset: number) => Promise<any[]>), attrs: string[]) {
  let offset = 0;
  while (true) {
    const items = await f(offset)
    for (const item of items) {
      await insertDocument(collection, item, attrs)
    }
    if (items.length < limit){
      break
    }
    offset += limit;
    console.log(`offset: ${offset}`)
    await sleep(50)
  }
}

async function main() {
  console.log(await projectsGroupsApi.getProject(projectId))
  // await labelsApi.addLabel(projectId, {
  //   "title": "placeholder"
  // })
  console.log(JSON.stringify(await labelsApi.listLabels(projectId)))

  const sourceStringCollection = client.db(dbName).collection(sourceString)
  console.log(`inserting ${sourceString}`)
  await sourceStringCollection.drop()
  await insertItems(sourceStringCollection, listSourceStrings, ["id"])
  
  const languageTranslationCollcetion = client.db(dbName).collection(languageTranslation)
  console.log(`inserting ${languageTranslation}`)
  await languageTranslationCollcetion.drop()
  for (let targetLanguage of targetLanguages) {
    await insertItems(languageTranslationCollcetion, (offset) => listLanguageTranslations(offset, targetLanguage), ["translationId", "stringId"]);
  }

  const translationApprovalCollcetion = client.db(dbName).collection(translationApproval)
  console.log(`inserting ${translationApproval}`)
  await translationApprovalCollcetion.drop()
  for (let targetLanguage of targetLanguages) {
    await insertItems(translationApprovalCollcetion, (offset) => listTranslationApprovals(offset, targetLanguage), ["translationId", "stringId"])
  }
}

main().then(()=>process.exit(0));
