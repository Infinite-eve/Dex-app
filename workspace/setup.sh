#!/bin/bash
#执行方法 终端进入bash
 # 给脚本添加执行权限
# chmod +x setup.sh

# # 运行脚本
# ./setup.sh

# 安装 nvm
echo "Installing nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装指定版本的 Node.js
echo "Installing Node.js..."
nvm install 22
nvm use 22

# 检查 node 版本
echo "Node version:"
node -v

# 安装根目录依赖
#OpenZeppelin合约是一个用Solidity编写的模块化、可重用且安全的智能合约库。
echo "Installing root dependencies..."
npm install --save-exact \
    hardhat@2.22.19 \
    @nomicfoundation/hardhat-toolbox@5.0.0 \
    @openzeppelin/contracts@5.2.0


# 进入前端目录安装依赖
echo "Installing frontend dependencies..."
cd frontend
npm install --save-exact \
    @testing-library/dom@10.4.0 \
    @testing-library/jest-dom@6.6.3 \
    @testing-library/react@16.2.0 \
    @testing-library/user-event@13.5.0 \
    bootstrap@5.3.3 \
    ethers@6.13.5 \
    react@19.0.0 \
    react-bootstrap@2.10.9 \
    react-dom@19.0.0 \
    react-scripts@5.0.1 \
    web-vitals@2.1.4 \
    web3@4.16.0\

#安装install bootstrap-icons
npm install bootstrap-icons

# 返回根目录
cd ..

# 编译合约
echo "Compiling contracts..."
npx hardhat compile

echo "Setup complete! Now you can:"
echo "1. Start local node: npx hardhat node"
echo "2. Deploy contracts: npx hardhat run scripts/deploy.js --network localhost"
echo "3. Start frontend: cd frontend && npm start"