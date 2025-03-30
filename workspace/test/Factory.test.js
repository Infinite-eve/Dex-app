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
        it("Should create a new pool", async function () {
            await expect(factory.createPool(token0.address, token1.address))
                .to.emit(factory, "PoolCreated")
                .withArgs(token0.address, token1.address, await factory.getPool(token0.address, token1.address));
        });

        it("Should not create duplicate pools", async function () {
            await factory.createPool(token0.address, token1.address);
            await expect(factory.createPool(token0.address, token1.address))
                .to.be.revertedWith("Pool exists");
        });
    });

    describe("Pool Operations", function () {
        let pool;

        beforeEach(async function () {
            // 创建池子
            await factory.createPool(token0.address, token1.address);
            const poolAddress = await factory.getPool(token0.address, token1.address);
            pool = await ethers.getContractAt("Pool", poolAddress);

            // 授权池子合约使用代币
            await token0.connect(user1).approve(poolAddress, ethers.parseEther("1000"));
            await token1.connect(user1).approve(poolAddress, ethers.parseEther("1000"));
        });

        it("Should add liquidity", async function () {
            const amount0 = ethers.parseEther("10");
            await expect(pool.connect(user1).addLiquidity(amount0))
                .to.emit(pool, "AddedLiquidity");

            const reserves = await pool.getReserves();
            expect(reserves[0]).to.equal(amount0);
            expect(reserves[1]).to.equal(amount0 * 2n); // 因为 INITIAL_RATIO = 2
        });

        it("Should swap tokens", async function () {
            // 首先添加流动性
            await pool.connect(user1).addLiquidity(ethers.parseEther("10"));

            // 进行代币交换
            const swapAmount = ethers.parseEther("1");
            await expect(pool.connect(user1).swap(
                token0.address,
                swapAmount,
                token1.address
            )).to.emit(pool, "Swapped");
        });
    });
});