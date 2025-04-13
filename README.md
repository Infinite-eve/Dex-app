# 测试步骤
## 1.部署基本环境
### (1)执行方法 终端进入bash，给脚本添加执行权限
```
chmod +x setup.sh
```
### (2)运行脚本
```
./setup.sh
```

## 2.前端运行
### 切换到frontend
```
cd workspace/frontend
npm run start
``` 

## 3.后端运行
### (1)切换到workspace，开启node
```
cd workspace
npx hardhat node
```
### (2)一键部署+转账
打开metamask，配置钱包，将scripts文件夹下的transferDF.js、transferALPHA.js、transferBETA.js、transferGAMMA.js中的地址修改为自己的metamask地址，开启Git bash终端，在终端内运行以下命令：
```
sh scripts/script.sh
```

## 4.测试方案运行
### 测试各功能是否完善
```
npx hardhat run test/测试文件名称.js --network localhost
npx hardhat run test/Swap.test.js --network localhost //测试交易费用及流动性提取相关功能
```

## 5.其他处理方案
按需查找，包含一些排错命令，和测试命令

### (1)清理前端缓存，避免前端合约未更新：
```
rm -rf node_modules/.cache
```
### (2)清空node
**HighLight**: 在每次调整代码后，建议清空node，否则会有未知错误
清空node之后，位于artifacts的缓存文件也会没有。这部分文件不需要上传至git，已添加.gitignore
```
npx hardhat clean
```
### (3)将测试代币转账到你的地址（需要先修改文件中的接收地址）
```
npx hardhat run scripts/transferDF.js --network localhost
```
```
npx hardhat run scripts/transferALPHA.js --network localhost
```
```
npx hardhat run scripts/transferBETA.js --network localhost
```
```
npx hardhat run scripts/transferGAMMA.js --network localhost
```
### (4)流动池初始充值
可运行指令后端实现流动性充值，默认为10ALPHA，20BETA，30 GAMMA
```
npx hardhat run scripts/anotherusr_add.js --network localhost
```
