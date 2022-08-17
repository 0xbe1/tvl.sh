const Web3 = require("web3");
require("dotenv").config();
const BNT_POOL_ABI = require("./abis/bnt-pool.json");
const BANCOR_NETWORK_ABI = require("./abis/bancor-network.json");
const BANCOR_NETWORK_INFO_ABI = require("./abis/bancor-network-info.json");
const ERC20_ABI = require("./abis/erc20.json");

const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const NODE_URL = `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
const web3 = new Web3(NODE_URL);

// addresses
const BANCOR_NETWORK_ADDR = "0xeEF417e1D5CC832e619ae18D2F140De2999dD4fB";
const BANCOR_NETWORK_INFO_ADDR = "0x8e303d296851b320e6a697bacb979d13c9d6e760";
const BNT_POOL_ADDR = "0x02651E355D26f3506C1E644bA393FDD9Ac95EaCa";
const DAI_ADDR = "0x6b175474e89094c44da98b954eedeac495271d0f";

const DAI_DECIMALS = 18;

// contracts
const bancorNetwork = new web3.eth.Contract(
  BANCOR_NETWORK_ABI,
  BANCOR_NETWORK_ADDR
);
const bancorNetworkInfo = new web3.eth.Contract(
  BANCOR_NETWORK_INFO_ABI,
  BANCOR_NETWORK_INFO_ADDR
);

async function nonBNTPools() {
  return await bancorNetwork.methods.liquidityPools().call();
}

async function stakedBalance(pool) {
  return await bancorNetworkInfo.methods.stakedBalance(pool).call();
}

async function bntStakedBalance() {
  const bntPool = new web3.eth.Contract(BNT_POOL_ABI, BNT_POOL_ADDR);
  return bntPool.methods.stakedBalance().call();
}

async function valueUSD(token, amountMantissa) {
  if (token.toLowerCase() === DAI_ADDR.toLowerCase()) {
    return amountMantissa / Math.pow(10, DAI_DECIMALS);
  }
  let decimals = await getDecimals(token);
  let amount = amountMantissa / Math.pow(10, decimals);
  console.log("amount:", amount);
  let priceDaiMantissa = await bancorNetworkInfo.methods
    .tradeOutputBySourceAmount(
      token,
      DAI_ADDR,
      // need to convert to string otherwise number overflow from web3.js
      Math.pow(10, decimals).toString()
    )
    .call();
  let priceDai = priceDaiMantissa / Math.pow(10, DAI_DECIMALS);
  console.log("priceDai:", priceDai);
  return priceDai * amount;
}

async function getDecimals(token) {
  if (
    token.toLowerCase() ===
    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase()
  ) {
    return Promise.resolve(18);
  }
  let erc20 = new web3.eth.Contract(ERC20_ABI, token);
  return await erc20.methods.decimals().call();
}

async function main() {
  // need a type cast otherwise pools is object, not array
  let pools = Array.from(await nonBNTPools());

  let balances = [];
  for (const pool of pools) {
    let tradingEnabled = await bancorNetworkInfo.methods
      .tradingEnabled(pool)
      .call();
    if (!tradingEnabled) {
      console.log("pool %s trading disabled", pool);
      continue;
    }
    let baseTokenAmount = await stakedBalance(pool);
    balances.push([pool, baseTokenAmount]);
  }
  // bnt
  let bnt = await bancorNetworkInfo.methods.bnt().call();
  let bntBalance = await bntStakedBalance();
  balances.push([bnt, bntBalance]);

  let tvl = 0;
  for (const [pool, amountMantissa] of balances) {
    console.log("========================\npool:", pool);
    let value = await valueUSD(pool, amountMantissa);
    console.log("poolTVL:", value);
    tvl += value;
  }

  console.log("========================\ntotal TVL:", tvl);
}

main();
