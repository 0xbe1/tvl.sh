# TVL.sh

A hub of scripts that computes TVL for various protocols.

Install dependencies.

```
yarn
```

Setup environment variables.

```
cp .env.example .env
// then fill in your Infura project ID
```

Run Compound for example.

```
node compound/index.js tvl -p [compound|cream-finance] -b [blockNumber]
```
