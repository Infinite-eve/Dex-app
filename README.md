# 测试步骤
## 编译
npx hardhat compile  

## 部署Deploy
ps：建议先编译一次，再开启node；否则会有Contract call:  <UnrecognizedContract>的报错
运行下面的部署命令，或者直接运行一键部署+转账脚本script.sh;忽略报错，重新开启节点再运行deploy之后，会出现 Contract deployment: NewToken /   Contract deployment: Factory 等正常名称
npx hardhat run --network localhost scripts/deploy.js   

## 开启node
npx hardhat node

### 清空node
!highlight: 在每次调整代码后，建议清空node，否则会有未知错误
清空node之后，位于artifacts的缓存文件也会没有。这部分文件不需要上传至git，已添加.gitignore
清空命令：npx hardhat clean

## 一键部署+转账
开启Git bash终端，在终端内运行以下命令：
sh scripts/script.sh

## 其他处理方案
按需查找，包含一些排错命令，和测试命令

### 1、清理前端缓存，避免前端合约未更新：
rm -rf node_modules/.cache

### 将测试代币转账到你的地址（需要先修改 scripts/transferDF.js 中的接收地址）
npx hardhat run scripts/transferDF.js --network localhost

### 转账 Alpha 代币（需要先修改 scripts/transferALPHA.js 中的接收地址）
npx hardhat run scripts/transferALPHA.js --network localhost

### 转账 Beta 代币（需要先修改 scripts/transferBETA.js 中的接收地址）
npx hardhat run scripts/transferBETA.js --network localhost

### 转账 GAMMA 代币（需要先修改 scripts/transferBETA.js 中的接收地址）
npx hardhat run scripts/transferGAMMA.js --network localhost
