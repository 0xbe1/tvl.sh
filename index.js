const Web3 = require("web3");
const CTOKEN_ABI = require("./abis/ctoken.json");
const COMPTROLLER_ABI = require("./abis/comptroller.json");
const ORACLE_ABI = require("./abis/oracle.json");
const ERC20_ABI = require("./abis/erc20.json");

const INFURA_PROJECT_ID = "eab64cc6778f4435b0e94c4b10d78da6";
const NODE_URL = `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
const web3 = new Web3(NODE_URL);

// contracts
const comptroller = new web3.eth.Contract(
  COMPTROLLER_ABI,
  "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b"
);
const oracle = new web3.eth.Contract(
  ORACLE_ABI,
  "0x65c816077c29b557bee980ae3cc2dce80204a0c5"
);

async function getAllMarkets() {
  return await comptroller.methods.getAllMarkets().call();
}

async function getUnderlyingPriceUSD(ctoken, underlyingDecimals) {
  let priceMantissa = await oracle.methods
    .getUnderlyingPrice(ctoken)
    .call();
  return priceMantissa / Math.pow(10, 36 - underlyingDecimals);
}

async function getMarketTVL(ctoken_addr, underlyingDecimals) {
  const ctoken = new web3.eth.Contract(CTOKEN_ABI, ctoken_addr);
  let totalSupply = await ctoken.methods.totalSupply().call();
  let exchangeRateCurrent = await ctoken.methods.exchangeRateCurrent().call();
  let underlyingBalance =
    (totalSupply * exchangeRateCurrent) / Math.pow(10, 18);
  let underlyingPriceUSD = await getUnderlyingPriceUSD(
    ctoken_addr,
    underlyingDecimals
  );
  return (
    (underlyingBalance * underlyingPriceUSD) / Math.pow(10, underlyingDecimals)
  );
}

async function getUnderlyingDecimals(ctoken_addr) {
  if (
    ctoken_addr.toLowerCase() === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5"
  ) {
    return 18;
  }
  if (
    ctoken_addr.toLowerCase() === "0xf5dce57282a584d2746faf1593d3121fcac444dc"
  ) {
    return 18;
  }
  const ctoken = new web3.eth.Contract(CTOKEN_ABI, ctoken_addr);
  const underlying_addr = await ctoken.methods.underlying().call();
  const underlying = new web3.eth.Contract(ERC20_ABI, underlying_addr);
  const decimals = await underlying.methods.decimals().call();
  return decimals;
}

async function main() {
  let tvl = 0;
  const ctokens = await getAllMarkets();
  for (const ctoken of ctokens) {
    console.log(ctoken);
    const underlyingDecimals = await getUnderlyingDecimals(ctoken);
    let marketTVL = await getMarketTVL(ctoken, underlyingDecimals);
    console.log(marketTVL);
    tvl += marketTVL;
  }
  console.log("total tvl:", tvl);
}

main();
