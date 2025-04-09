npx hardhat run --network localhost scripts/deploy.js

### 将测试代币转账到你的地址（需要先修改 scripts/transferDF.js 中的接收地址）
npx hardhat run scripts/transferDF.js --network localhost

### 转账 Alpha 代币（需要先修改 scripts/transferALPHA.js 中的接收地址）
npx hardhat run scripts/transferALPHA.js --network localhost

### 转账 Beta 代币（需要先修改 scripts/transferBETA.js 中的接收地址）
npx hardhat run scripts/transferBETA.js --network localhost

### 转账 GAMMA 代币（需要先修改 scripts/transferBETA.js 中的接收地址）
npx hardhat run scripts/transferGAMMA.js --network localhost