const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pool Contract", function () {
    let Pool, NewToken, pool, alphaToken, betaToken;
    let owner, addr1, addr2;
    const INITIAL_SUPPLY = ethers.parseEther("1000000");

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // 部署代币合约
        NewToken = await ethers.getContractFactory("NewToken");
        alphaToken = await NewToken.deploy("Alpha", "ALPHA");
        await alphaToken.waitForDeployment();
        
        betaToken = await NewToken.deploy("Beta", "BETA");
        await betaToken.waitForDeployment();

        // 部署Pool合约
        Pool = await ethers.getContractFactory("Pool");
        pool = await Pool.deploy(
            await alphaToken.getAddress(),
            await betaToken.getAddress()
        );
        await pool.waitForDeployment();

        // 给测试账户转一些代币
        await alphaToken.transfer(addr1.address, ethers.parseEther("1000"));
        await betaToken.transfer(addr1.address, ethers.parseEther("2000"));
        await alphaToken.transfer(addr2.address, ethers.parseEther("1000"));
        await betaToken.transfer(addr2.address, ethers.parseEther("2000"));
    });

    describe("addLiquidity", function () {
        it("should add initial liquidity and mint LP tokens", async function () {
            const amount0 = ethers.parseEther("100");
            const amount1 = await pool.getRequiredAmount1(amount0);
            const minAmount1 = amount1 * BigInt(995) / BigInt(1000); // 0.5% 滑点
            const minLPAmount = amount0 * BigInt(995) / BigInt(1000); // 0.5% 滑点

            // 授权代币
            await alphaToken.connect(addr1).approve(await pool.getAddress(), amount0);
            await betaToken.connect(addr1).approve(await pool.getAddress(), amount1);

            // 添加流动性
            await expect(pool.connect(addr1).addLiquidity(amount0, minAmount1, minLPAmount))
                .to.emit(pool, "AddedLiquidity")
                .withArgs(
                    amount0, // LP Token数量
                    await alphaToken.getAddress(),
                    amount0,
                    await betaToken.getAddress(),
                    amount1
                );
        });

        it("should add liquidity proportionally when pool has reserves", async function () {
            // 首先添加初始流动性
            const initialAmount0 = ethers.parseEther("100");
            const initialAmount1 = await pool.getRequiredAmount1(initialAmount0);
            const initialMinAmount1 = initialAmount1 * BigInt(995) / BigInt(1000);
            const initialMinLPAmount = initialAmount0 * BigInt(995) / BigInt(1000);

            await alphaToken.connect(addr1).approve(await pool.getAddress(), initialAmount0);
            await betaToken.connect(addr1).approve(await pool.getAddress(), initialAmount1);
            await pool.connect(addr1).addLiquidity(initialAmount0, initialMinAmount1, initialMinLPAmount);

            // 添加更多流动性
            const amount0 = ethers.parseEther("100");
            const amount1 = await pool.getRequiredAmount1(amount0);
            const minAmount1 = amount1 * BigInt(995) / BigInt(1000);
            const minLPAmount = amount0 * BigInt(995) / BigInt(1000);

            await alphaToken.connect(addr2).approve(await pool.getAddress(), amount0);
            await betaToken.connect(addr2).approve(await pool.getAddress(), amount1);
            await expect(pool.connect(addr2).addLiquidity(amount0, minAmount1, minLPAmount))
                .to.emit(pool, "AddedLiquidity");
        });

        it("should revert when adding zero liquidity", async function () {
            const amount0 = 0;
            const amount1 = 0;
            const minAmount1 = 0;
            const minLPAmount = 0;

            await expect(
                pool.connect(addr1).addLiquidity(amount0, minAmount1, minLPAmount)
            ).to.be.revertedWith("Amount must be greater than 0");
        });
    });

    describe("滑点保护功能", function () {
        it("应该成功添加流动性（在允许的滑点范围内）", async function () {
            // 转移代币给addr2
            await alphaToken.transfer(addr2.address, ethers.parseEther("1000"));
            await betaToken.transfer(addr2.address, ethers.parseEther("2000"));

            // 设置合理的滑点范围
            const amount0 = ethers.parseEther("100");
            const amount1 = await pool.getRequiredAmount1(amount0);
            const minAmount1 = amount1 * BigInt(99) / BigInt(100); // 允许1%的滑点
            const minLPAmount = amount0 * BigInt(99) / BigInt(100); // 允许1%的滑点

            // 使用addr2添加流动性
            await alphaToken.connect(addr2).approve(await pool.getAddress(), amount0);
            await betaToken.connect(addr2).approve(await pool.getAddress(), amount1);

            await expect(pool.connect(addr2).addLiquidity(amount0, minAmount1, minLPAmount))
                .to.emit(pool, "AddedLiquidity")
                .withArgs(
                    amount0, // LP Token数量
                    await alphaToken.getAddress(), // token0地址
                    amount0, // token0数量
                    await betaToken.getAddress(), // token1地址
                    amount1 // token1数量
                );
        });

        it("应该在滑点过大时回滚", async function () {
            // 转移代币给addr2
            await alphaToken.transfer(addr2.address, ethers.parseEther("1000"));
            await betaToken.transfer(addr2.address, ethers.parseEther("2000"));

            const amount0 = ethers.parseEther("100");
            const amount1 = await pool.getRequiredAmount1(amount0);
            
            // 设置一个明显过高的最小金额，确保滑点检查失败
            const minAmount1 = amount1 * BigInt(101) / BigInt(100); // 要求比实际多1%
            const minLPAmount = amount0 * BigInt(99) / BigInt(100);

            await alphaToken.connect(addr2).approve(await pool.getAddress(), amount0);
            await betaToken.connect(addr2).approve(await pool.getAddress(), amount1);

            await expect(pool.connect(addr2).addLiquidity(amount0, minAmount1, minLPAmount))
                .to.be.revertedWith("Slippage too high for token1");
        });

        it("应该成功移除流动性（在允许的滑点范围内）", async function () {
            // 先添加一些流动性
            const amount0 = ethers.parseEther("100");
            const amount1 = await pool.getRequiredAmount1(amount0);
            const minAmount1 = amount1 * BigInt(99) / BigInt(100);
            const minLPAmount = amount0 * BigInt(99) / BigInt(100);

            await alphaToken.approve(await pool.getAddress(), amount0);
            await betaToken.approve(await pool.getAddress(), amount1);
            await pool.addLiquidity(amount0, minAmount1, minLPAmount);

            // 设置合理的滑点范围
            const withdrawAmount0 = ethers.parseEther("50");
            const withdrawAmount1 = await pool.getRequiredAmount1(withdrawAmount0);
            const minWithdrawAmount1 = withdrawAmount1 * BigInt(99) / BigInt(100);
            const minWithdrawLPAmount = withdrawAmount0 * BigInt(99) / BigInt(100);

            await expect(pool.withdrawingliquidity(withdrawAmount0, minWithdrawAmount1, minWithdrawLPAmount))
                .to.emit(pool, "WithdrawLiquidity")
                .withArgs(
                    withdrawAmount0, // LP Token数量
                    await alphaToken.getAddress(), // token0地址
                    withdrawAmount0, // token0数量
                    await betaToken.getAddress(), // token1地址
                    withdrawAmount1 // token1数量
                );
        });

        it("应该在移除流动性时滑点过大时回滚", async function () {
            // 先添加一些流动性
            const amount0 = ethers.parseEther("100");
            const amount1 = await pool.getRequiredAmount1(amount0);
            const minAmount1 = amount1 * BigInt(99) / BigInt(100);
            const minLPAmount = amount0 * BigInt(99) / BigInt(100);

            await alphaToken.approve(await pool.getAddress(), amount0);
            await betaToken.approve(await pool.getAddress(), amount1);
            await pool.addLiquidity(amount0, minAmount1, minLPAmount);

            const withdrawAmount0 = ethers.parseEther("50");
            const withdrawAmount1 = await pool.getRequiredAmount1(withdrawAmount0);
            
            // 设置一个明显过高的最小金额，确保滑点检查失败
            const minWithdrawAmount1 = withdrawAmount1 * BigInt(101) / BigInt(100);
            const minWithdrawLPAmount = withdrawAmount0 * BigInt(99) / BigInt(100);

            await expect(pool.withdrawingliquidity(withdrawAmount0, minWithdrawAmount1, minWithdrawLPAmount))
                .to.be.revertedWith("Slippage too high for token1");
        });
    });
});