const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Factory and Pool", function () {
    let Factory, Pool;
    let factory;
    let token0, token1, token2; // 测试用的 ERC20 代币
    let owner, user1, user2;

    beforeEach(async function () {
        // 获取合约工厂
        Factory = await ethers.getContractFactory("Factory");
        const TestToken = await ethers.getContractFactory("TestToken"); // 你需要创建一个测试代币合约

        // 获取测试账户
        [owner, user1, user2] = await ethers.getSigners();

        // 部署测试代币
        token0 = await TestToken.deploy("Token0", "TK0");
        token1 = await TestToken.deploy("Token1", "TK1");
        token2 = await TestToken.deploy("Token2", "TK2");

        // 部署工厂合约
        factory = await Factory.deploy();

        // 给测试账户铸造一些代币
        const mintAmount = ethers.parseEther("1000");
        await token0.mint(user1.address, mintAmount);
        await token1.mint(user1.address, mintAmount);
        await token2.mint(user1.address, mintAmount);
    });

    describe("Pool Creation", function () {
        it("Should create a new pool with three tokens", async function () {
            await expect(factory.createPool(token0.address, token1.address, token2.address))
                .to.emit(factory, "PoolCreated")
                .withArgs(
                    token0.address, 
                    token1.address, 
                    token2.address, 
                    await factory.getPool(token0.address, token1.address, token2.address)
                );
        });

        it("Should not create duplicate pools", async function () {
            await factory.createPool(token0.address, token1.address, token2.address);
            await expect(factory.createPool(token0.address, token1.address, token2.address))
                .to.be.revertedWith("Pool exists");
        });

        it("Should retrieve the same pool address regardless of token order", async function () {
            // Create a pool with token0, token1, token2
            await factory.createPool(token0.address, token1.address, token2.address);
            const poolAddress = await factory.getPool(token0.address, token1.address, token2.address);
            
            // Test different token orders return the same pool
            expect(await factory.getPool(token0.address, token2.address, token1.address)).to.equal(poolAddress);
            expect(await factory.getPool(token1.address, token0.address, token2.address)).to.equal(poolAddress);
            expect(await factory.getPool(token1.address, token2.address, token0.address)).to.equal(poolAddress);
            expect(await factory.getPool(token2.address, token0.address, token1.address)).to.equal(poolAddress);
            expect(await factory.getPool(token2.address, token1.address, token0.address)).to.equal(poolAddress);
        });
    });

    describe("Pool Operations", function () {
        let pool;

        beforeEach(async function () {
            // 创建池子
            await factory.createPool(token0.address, token1.address, token2.address);
            const poolAddress = await factory.getPool(token0.address, token1.address, token2.address);
            pool = await ethers.getContractAt("Pool", poolAddress);

            // 授权池子合约使用代币
            await token0.connect(user1).approve(poolAddress, ethers.parseEther("1000"));
            await token1.connect(user1).approve(poolAddress, ethers.parseEther("1000"));
            await token2.connect(user1).approve(poolAddress, ethers.parseEther("1000"));
        });

        it("Should add liquidity with three tokens", async function () {
            const amount0 = ethers.parseEther("10");
            await expect(pool.connect(user1).addLiquidity(amount0))
                .to.emit(pool, "AddedLiquidity");

            const reserves = await pool.getReserves();
            expect(reserves[0]).to.equal(amount0);
            expect(reserves[1]).to.equal(amount0 * 2n); // 因为 INITIAL_RATIO_1 = 2
            expect(reserves[2]).to.equal(amount0 * 3n); // 因为 INITIAL_RATIO_2 = 3
        });

        it("Should swap tokens between any pair in the pool", async function () {
            // 首先添加流动性
            await pool.connect(user1).addLiquidity(ethers.parseEther("10"));

            // 进行代币交换 - token0 to token1
            const swapAmount01 = ethers.parseEther("1");
            await expect(pool.connect(user1).swap(
                token0.address,
                swapAmount01,
                token1.address
            )).to.emit(pool, "Swapped");

            // 进行代币交换 - token0 to token2
            const swapAmount02 = ethers.parseEther("1");
            await expect(pool.connect(user1).swap(
                token0.address,
                swapAmount02,
                token2.address
            )).to.emit(pool, "Swapped");

            // 进行代币交换 - token1 to token2
            const swapAmount12 = ethers.parseEther("1");
            await expect(pool.connect(user1).swap(
                token1.address,
                swapAmount12,
                token2.address
            )).to.emit(pool, "Swapped");
        });

        it("Should withdraw liquidity correctly", async function () {
            // 添加流动性
            const addAmount = ethers.parseEther("10");
            await pool.connect(user1).addLiquidity(addAmount);
            
            // 提取流动性
            const withdrawAmount = ethers.parseEther("5");
            
            // 获取提取前余额
            const balanceBefore0 = await token0.balanceOf(user1.address);
            const balanceBefore1 = await token1.balanceOf(user1.address);
            const balanceBefore2 = await token2.balanceOf(user1.address);
            
            // 提取流动性
            await pool.connect(user1).withdrawingliquidity(withdrawAmount);
            
            // 验证提取后的余额变化
            const balanceAfter0 = await token0.balanceOf(user1.address);
            const balanceAfter1 = await token1.balanceOf(user1.address);
            const balanceAfter2 = await token2.balanceOf(user1.address);
            
            expect(balanceAfter0 - balanceBefore0).to.equal(withdrawAmount);
            expect(balanceAfter1 - balanceBefore1).to.equal(withdrawAmount * 2n);
            expect(balanceAfter2 - balanceBefore2).to.equal(withdrawAmount * 3n);
            
            // 验证池子余额
            const reserves = await pool.getReserves();
            expect(reserves[0]).to.equal(addAmount - withdrawAmount);
            expect(reserves[1]).to.equal((addAmount - withdrawAmount) * 2n);
            expect(reserves[2]).to.equal((addAmount - withdrawAmount) * 3n);
        });
    });

    describe("Token Management", function () {
        it("Should track supported tokens correctly", async function () {
            // 初始状态应该没有支持的代币
            expect(await factory.getSupportedTokensLength()).to.equal(0);
            
            // 创建池子后应该有三个支持的代币
            await factory.createPool(token0.address, token1.address, token2.address);
            expect(await factory.getSupportedTokensLength()).to.equal(3);
            
            // 确认代币被正确标记为支持
            expect(await factory.isTokenSupported(token0.address)).to.be.true;
            expect(await factory.isTokenSupported(token1.address)).to.be.true;
            expect(await factory.isTokenSupported(token2.address)).to.be.true;
        });
    });
});