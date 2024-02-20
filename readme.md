# How to Use

## Init Env

### Prepare your Token

Create your crowdin token at https://crowdin.com/settings#api-key

```sh
cp .env.sample .env
```

Then edit the `.env` file and paste your crowdin token.

### Install Dependency

Install dependency:

```sh
yarn
```

### Install Mongodb

`mongodb` is required for this repo. Please refer to the official documents to download and install mongodb. We suppose `mongodb` runs on port 27017 and no authentication is required.

## Run

Collect Info:

```sh
yarn ts-node index.ts
```

Count reward:

```sh
yarn ts-node count-reward.ts
```
