# 测试转账

compilation:
npx hardhat compile  

deploy:
npx hardhat run --network localhost scripts/deploy.js   

### 将测试代币转账到你的地址（需要先修改 scripts/transferDF.js 中的接收地址）
npx hardhat run scripts/transferDF.js --network localhost

### 转账 Alpha 代币（需要先修改 scripts/transferALPHA.js 中的接收地址）
npx hardhat run scripts/transferALPHA.js --network localhost

### 转账 Beta 代币（需要先修改 scripts/transferBETA.js 中的接收地址）
npx hardhat run scripts/transferBETA.js --network localhost

### 转账 GAMMA 代币（需要先修改 scripts/transferBETA.js 中的接收地址）
npx hardhat run scripts/transferGAMMA.js --network localhost


const Pool = await hre.ethers.getContractFactory("Pool");
const pool = Pool.attach('0x856e4424f806D16E8CBC702B3c0F2ede5468eae5')
const NewToken = await hre.ethers.getContractFactory("NewToken");
const Alpha = NewToken.attach('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512')
const Beta = NewToken.attach('0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0')
const Gamma = NewToken.attach('0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9')
await Alpha.approve('0x51C87a004CEa3f03a77A5398Bb0B7EEb15DAB92f', ethers.parseEther("1000000"))
await Beta.approve('0x51C87a004CEa3f03a77A5398Bb0B7EEb15DAB92f', ethers.parseEther("1000000"))
