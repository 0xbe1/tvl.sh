const Web3 = require("web3");
require("dotenv").config();
const yargs = require("yargs");

const CONFIG = require("./config.json");
const CTOKEN_ABI = require("./abis/ctoken.json");
const COMPTROLLER_ABI = require("./abis/comptroller.json");
const ORACLE_ABI = require("./abis/oracle.json");
const ERC20_ABI = require("./abis/erc20.json");

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const NODE_URL = `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
const web3 = new Web3(NODE_URL);

// config
const argv = yargs
  .command("tvl", "TVL", {
    protocol: {
      description: "the protocol",
      alias: "p",
      type: "string",
    },
  })
  .option("blockNumber", {
    alias: "b",
    description: "Block Number",
    type: "number",
  })
  .help()
  .alias("help", "h").argv;

const { comptrollerAddr, oracleAddr, ctokenToUnderlyingDecimals } =
  CONFIG[argv.protocol];

// contracts
const comptroller = new web3.eth.Contract(COMPTROLLER_ABI, comptrollerAddr);
const oracle = new web3.eth.Contract(ORACLE_ABI, oracleAddr);

main(argv.blockNumber);

//
// helpers
//
async function getAllMarkets(blockNumber) {
  return await comptroller.methods.getAllMarkets().call({}, blockNumber);
}

// NOTE price could be either in USD or ETH depending on oracle implementation
async function getUnderlyingPrice(blockNumber, ctoken, underlyingDecimals) {
  let priceMantissa = await oracle.methods
    .getUnderlyingPrice(ctoken)
    .call({}, blockNumber);
  return priceMantissa / Math.pow(10, 36 - underlyingDecimals);
}

async function getMarketTVL(blockNumber, ctokenAddr, underlyingDecimals) {
  try {
    const ctoken = new web3.eth.Contract(CTOKEN_ABI, ctokenAddr);
    let totalSupply = await ctoken.methods.totalSupply().call({}, blockNumber);
    console.log("totalSupply", totalSupply);
    let exchangeRateCurrent = await ctoken.methods
      .exchangeRateCurrent()
      .call({}, blockNumber);
    console.log("exchangeRateCurrent", exchangeRateCurrent);
    let underlyingBalance =
      (totalSupply * exchangeRateCurrent) / Math.pow(10, 18);
    console.log("underlyingBalance", underlyingBalance);
    let underlyingPrice = await getUnderlyingPrice(
      blockNumber,
      ctokenAddr,
      underlyingDecimals
    );
    console.log("underlyingPrice", underlyingPrice);
    return (
      (underlyingBalance * underlyingPrice) / Math.pow(10, underlyingDecimals)
    );
  } catch (error) {
    console.error(error);
    return 0;
  }
}

async function getUnderlyingDecimals(blockNumber, ctokenAddr, special_cases) {
  for (const [addr, decimals] of Object.entries(special_cases)) {
    if (ctokenAddr.toLowerCase() === addr.toLowerCase()) {
      return decimals;
    }
  }
  const ctoken = new web3.eth.Contract(CTOKEN_ABI, ctokenAddr);
  const underlying_addr = await ctoken.methods
    .underlying()
    .call({}, blockNumber);
  const underlying = new web3.eth.Contract(ERC20_ABI, underlying_addr);
  const decimals = await underlying.methods.decimals().call({}, blockNumber);
  return decimals;
}

async function main(blockNumber) {
  console.log("block number", blockNumber);
  let tvl = 0;
  const ctokens = await getAllMarkets(blockNumber);
  for (const ctoken of ctokens) {
    console.log("==============================");
    console.log("market", ctoken);
    const underlyingDecimals = await getUnderlyingDecimals(
      blockNumber,
      ctoken,
      ctokenToUnderlyingDecimals
    );
    let marketTVL = await getMarketTVL(blockNumber, ctoken, underlyingDecimals);
    console.log("marketTVL", marketTVL);
    tvl += marketTVL;
  }
  console.log("==============================");
  console.log("protocolTVL:", tvl);
}
