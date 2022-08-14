const Web3 = require("web3");
const CERC20_ABI = require("./cerc20.json")

const INFURA_PROJECT_ID = "c2838024e339438fbe8a31d6754efe8a";
const NODE_URL = `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;
const web3 = new Web3(NODE_URL);

async function main() {
    const cerc20 = new web3.eth.Contract(CERC20_ABI, '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643')
    cerc20.methods.name().call({}, function(error, result){
        console.log(JSON.stringify(result))
    });
}

main()