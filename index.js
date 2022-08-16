const Web3 = require("web3");
require("dotenv").config();
const CONFIG = require("./config.json");
const CTOKEN_ABI = require("./abis/ctoken.json");
const COMPTROLLER_ABI = require("./abis/comptroller.json");
const ORACLE_ABI = require("./abis/oracle.json");
const ERC20_ABI = require("./abis/erc20.json");

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const NODE_URL = `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
const web3 = new Web3(NODE_URL);

// config
const protocol = process.argv.slice(2)[0];
const { comptrollerAddr, oracleAddr, ctokenToUnderlyingDecimals } =
  CONFIG[protocol];

// contracts
const comptroller = new web3.eth.Contract(COMPTROLLER_ABI, comptrollerAddr);
const oracle = new web3.eth.Contract(ORACLE_ABI, oracleAddr);

main();

// helpers

async function getAllMarkets() {
  return await comptroller.methods.getAllMarkets().call();
}

// NOTE price could be either in USD or ETH depending on oracle implementation
async function getUnderlyingPrice(ctoken, underlyingDecimals) {
  let priceMantissa = await oracle.methods.getUnderlyingPrice(ctoken).call();
  return priceMantissa / Math.pow(10, 36 - underlyingDecimals);
}

async function getMarketTVL(ctoken_addr, underlyingDecimals) {
  try {
    const ctoken = new web3.eth.Contract(CTOKEN_ABI, ctoken_addr);
    let totalSupply = await ctoken.methods.totalSupply().call();
    console.log("totalSupply", totalSupply);
    let exchangeRateCurrent = await ctoken.methods.exchangeRateCurrent().call();
    console.log("exchangeRateCurrent", exchangeRateCurrent);
    let underlyingBalance =
      (totalSupply * exchangeRateCurrent) / Math.pow(10, 18);
    console.log("underlyingBalance", underlyingBalance);
    let underlyingPrice = await getUnderlyingPrice(
      ctoken_addr,
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

async function getUnderlyingDecimals(ctoken_addr, special_cases) {
  for (const [addr, decimals] of Object.entries(special_cases)) {
    if (ctoken_addr.toLowerCase() === addr.toLowerCase()) {
      return decimals;
    }
  }
  const ctoken = new web3.eth.Contract(CTOKEN_ABI, ctoken_addr);
  const underlying_addr = await ctoken.methods.underlying().call();
  const underlying = new web3.eth.Contract(ERC20_ABI, underlying_addr);
  const decimals = await underlying.methods.decimals().call();
  return decimals;
}

async function main() {
  let tvl = 0;
  // TODO: get block number
  const ctokens = await getAllMarkets();
  for (const ctoken of ctokens) {
    console.log("==============================");
    console.log("market", ctoken);
    const underlyingDecimals = await getUnderlyingDecimals(
      ctoken,
      ctokenToUnderlyingDecimals
    );
    let marketTVL = await getMarketTVL(ctoken, underlyingDecimals);
    console.log("marketTVL", marketTVL);
    tvl += marketTVL;
  }
  console.log("==============================");
  console.log("protocolTVL:", tvl);
}
