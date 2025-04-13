# 项目介绍
本项目实现了一个支持三种ERC20代币​​的流动性池（Pool），基于​​自动做市商（AMM）模型，支持以下核心功能：
## ​核心功能​​
### 多代币和多流动性池
支持通过工厂合约（Factory）创建多个流动性池。总共三个流动资金池，每个池包含 2-3 个代币。
### ​流动性管理​​
​​添加流动性（Add Liquidity）​​：用户按比例存入三种代币，获得LP Token作为流动性凭证。

​​提取流动性（Withdraw Liquidity）​​：用户销毁LP Token，按比例取回池中的三种代币。

​​初始比例设定​​：首次添加流动性时，采用 1:2:3 的初始比例（可调整）。
### ​代币兑换（Swap）​​
支持任意两种代币之间的兑换。

采用 ​​0.3% 交易手续费​​（可调整），其中手续费自动存入LP激励池。

​交易手续费和额外激励按LP Token持有比例分配。

用户可随时提取属于自己的激励份额或withdraw时跟本金一起提取。
### 智能路由跨池交互
实现交易路径及遍历最优路径选择

# 运行指引
## 1.环境准备
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
### (2)配置metamask
连接至 http://localhost:8545（Hardhat本地节点）。

按照workspace/frontend/deployed-address中的代币地址，将代币载入到钱包中
### (3)一键部署+转账
将scripts文件夹下的transferDF.js、transferALPHA.js、transferBETA.js、transferGAMMA.js中的地址修改为自己的metamask地址，开启Git bash终端，在终端内运行以下命令：
```
sh scripts/script.sh
```

## 4.测试方案运行
### 测试各功能是否完善
```
npx hardhat run test/测试文件名称.js --network localhost
npx hardhat run test/Swap.test.js --network localhost //测试交易费用及流动性提取相关功能
```

# 故障解决方法
按需查找，包含一些排错命令，和测试命令

## (1)清理前端缓存，避免前端合约未更新：
```
rm -rf node_modules/.cache
```
## (2)清空node
**HighLight**: 在每次调整代码后，建议清空node，否则会有未知错误

清空node之后，位于artifacts的缓存文件也会没有。这部分文件不需要上传至git，已添加.gitignore
```
npx hardhat clean
```

## (3)将测试代币转账到你的地址（需要先修改文件中的接收地址）
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
## (4)流动池初始充值
可运行指令后端实现流动性充值，默认为10ALPHA，20BETA，30 GAMMA
```
npx hardhat run scripts/anotherusr_add.js --network localhost
```
