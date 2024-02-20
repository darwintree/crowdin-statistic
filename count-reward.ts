import { MongoClient, Collection } from "mongodb";
import { StringTranslationsModel } from "@crowdin/crowdin-api-client"

function count_cjk(str: string) {
    return (str.match(/[\u4e00-\u9fa5]/g) || []).length
}



function inProperDateRange(date: Date) {
    const fromDate = new Date('2023-12-01T04:00:00+00:00')
    const toDate = new Date('2024-02-10T04:00:00+00:00')
    return date < toDate && date > fromDate
}

interface Translation {
    translationId: number;
    stringId: number;
    // originalText: string;
    translationText: string;
    translator: string;
    createdAt: Date;
}

interface Approval {
    translationId: number;
    stringId: number;
    createdAt: Date;
    languageId: string;
    approver: string;
}



const approvalList: Approval[] = []

interface TranslationResult  {
    translatedCount: number;
    approvedCount: number;
    translatedChineseCount: number;
    approvedChineseCount: number;
}



const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
const dbName = "crowdinConflux"
const languageTranslation = "languageTranslation"
const translationApproval = "translationApproval"

async function initTranslationMap(translationMap: {[key: string]: Translation }) {
    const languageTranslationCollcetion = client.db(dbName).collection(languageTranslation)
    const languageTranslations = (await languageTranslationCollcetion.find({}).toArray()) as unknown as StringTranslationsModel.PlainLanguageTranslation[]
    languageTranslations.forEach((translation) => {
        // translationId is already assigned
        if (translationMap[String(translation.translationId)] != undefined) {
            // only the one created ealier is preserved and do nothing
            if (translationMap[String(translation.translationId)].createdAt <= new Date(translation.createdAt)) {
                return
            } else {
                console.log(`translation ${translation.translationId} created at ${translationMap[String(translation.translationId)].createdAt} is overwritten by ${new Date(translation.createdAt)}`)
            }
        }
        translationMap[String(translation.translationId)] = {
            translationId: translation.translationId,
            stringId: translation.stringId,
            translationText: translation.text,
            createdAt: new Date(translation.createdAt),
            translator: translation.user.username,
        }
    })
}

async function initApprovalList(approvalList: Approval[]) {
    const translationApprovalCollcetion = client.db(dbName).collection(translationApproval)
    const translationApprovals = (await translationApprovalCollcetion.find({}).toArray()) as unknown as StringTranslationsModel.Approval[]
    translationApprovals.forEach((approval) => {
        approvalList.push({
            translationId: approval.translationId,
            stringId: approval.stringId,
            createdAt: new Date(approval.createdAt),
            languageId: approval.languageId,
            approver: approval.user.username,
        })
    })
}

function countTranslationReward(translationMap: {[key: string]: Translation }, translatedResultMap: {[key: string]: TranslationResult }) {
    for (const translationId in translationMap) {
        const translation = translationMap[translationId]
        if (translatedResultMap[translation.translator] === undefined) {
            translatedResultMap[translation.translator] = {
                translatedCount: 0,
                approvedCount: 0,
                translatedChineseCount: 0,
                approvedChineseCount: 0,
            }
        }
        if (inProperDateRange(translation.createdAt)) {
            translatedResultMap[translation.translator].translatedCount += 1
            translatedResultMap[translation.translator].translatedChineseCount += count_cjk(translation.translationText)
        }
    }
}

function countApprovalReward(approvalList: Approval[], translationMap: {[key: string]: Translation }, translatedResultMap: {[key: string]: TranslationResult }) {
    for(let approval of approvalList) {
        const translation = translationMap[String(approval.translationId)]
        if (!translation) {
            console.warn(approval)
            console.warn(`no original translation for approval`)
            continue
        }
        if (translatedResultMap[translation.translator] === undefined) {
            translatedResultMap[translation.translator] = {
                translatedCount: 0,
                approvedCount: 0,
                translatedChineseCount: 0,
                approvedChineseCount: 0,
            }
        }
        if (inProperDateRange(approval.createdAt)) {
            translatedResultMap[translation.translator].approvedCount += 1
            translatedResultMap[translation.translator].approvedChineseCount += count_cjk(translation.translationText)
        }
    }
}

async function main() {
    // key is translationId
    // if there are different stringId, we only accept the one with the earliest createdAt
    const translationMap: {
        [key: string]: Translation
    } = {}

    // translatorName: result
    const translatedResultMap: {
        [key: string]: TranslationResult
    } = {}

    // init translationMap from languageTranslations
    await initTranslationMap(translationMap)

    // init approvalList from Approvals
    await initApprovalList(approvalList)

    // iter translationMap and select the ones inProperDateRange and update result
    countTranslationReward(translationMap, translatedResultMap)

    // iter approvalList and select the ones inProperDateRange and update result
    countApprovalReward(approvalList, translationMap, translatedResultMap)

    // print result
    console.log(translatedResultMap)
    console.log("finished")
}

main().then(()=>process.exit(0))

