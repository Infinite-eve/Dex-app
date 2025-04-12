// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Factory.sol";
import "./Pool.sol";

/**
 * @title Router
 * @dev 路由合约负责查找最佳交换路径并执行跨池交易
 */
contract Router is ReentrancyGuard {
    // 工厂合约引用
    Factory public immutable factory;
    
    // 事件
    event SwapRouted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address[] path
    );

    constructor(address _factory) {
        require(_factory != address(0), "Zero factory address");
        factory = Factory(_factory);
    }

    /**
     * @dev 通过中间代币计算多跳交换的输出量
     */
    function _calculateMidRouteAmount(
        address firstPool, 
        address secondPool,
        address tokenIn, 
        address midToken, 
        address tokenOut
    ) internal view returns (uint256) {
        uint256 testAmount = 1e18; // 用于计算的标准测试金额
        uint256 midAmount = Pool(firstPool).getAmountOut(tokenIn, testAmount, midToken);
        return Pool(secondPool).getAmountOut(midToken, midAmount, tokenOut);
    }

    /**
     * @dev 获取从tokenIn到tokenOut的最佳路径
     * @param tokenIn 输入代币地址
     * @param tokenOut 输出代币地址
     * @return path 最佳交换路径中的代币地址数组
     * @return pools 路径中对应的池子地址数组
     */
    function findBestPath(
        address tokenIn,
        address tokenOut
    ) public view returns (address[] memory path, address[] memory pools) {
        // 检查是否有直接路径（两个代币在同一个池中）
        address[] memory directPoolTokens = new address[](2);
        directPoolTokens[0] = tokenIn;
        directPoolTokens[1] = tokenOut;
        
        address directPool = factory.getPool(directPoolTokens);
        
        // 如果有直接路径，返回简单路径
        if (directPool != address(0)) {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            
            pools = new address[](1);
            pools[0] = directPool;
            
            return (path, pools);
        }
        
        // 否则寻找中间路径（最多一个中间代币）
        address[] memory supportedTokens = getSupportedTokens();
        
        uint256 bestAmountOut = 0;
        address[] memory bestPath;
        address[] memory bestPools;
        
        // 尝试通过每个支持的代币作为中间代币
        for (uint i = 0; i < supportedTokens.length; i++) {
            address midToken = supportedTokens[i];
            
            // 跳过输入和输出代币
            if (midToken == tokenIn || midToken == tokenOut) {
                continue;
            }
            
            // 检查第一跳
            address[] memory firstHopTokens = new address[](2);
            firstHopTokens[0] = tokenIn;
            firstHopTokens[1] = midToken;
            address firstPool = factory.getPool(firstHopTokens);
            
            // 检查第二跳
            address[] memory secondHopTokens = new address[](2);
            secondHopTokens[0] = midToken;
            secondHopTokens[1] = tokenOut;
            address secondPool = factory.getPool(secondHopTokens);
            
            // 如果找到完整路径
            if (firstPool != address(0) && secondPool != address(0)) {
                // 计算此路径的输出金额
                uint256 amountOut = _calculateMidRouteAmount(
                    firstPool, 
                    secondPool,
                    tokenIn, 
                    midToken, 
                    tokenOut
                );
                
                // 如果这是最佳路径，更新记录
                if (amountOut > bestAmountOut) {
                    bestAmountOut = amountOut;
                    
                    bestPath = new address[](3);
                    bestPath[0] = tokenIn;
                    bestPath[1] = midToken;
                    bestPath[2] = tokenOut;
                    
                    bestPools = new address[](2);
                    bestPools[0] = firstPool;
                    bestPools[1] = secondPool;
                }
            }
        }
        
        // 如果找到了有效路径，返回
        if (bestPath.length > 0) {
            return (bestPath, bestPools);
        }
        
        // 如果找不到任何路径，返回空
        revert("No path found");
    }
    
    /**
     * @dev 获取所有支持的代币列表
     * @return 支持的代币地址数组
     */
    function getSupportedTokens() public view returns (address[] memory) {
        // 使用新添加的方法获取所有支持的代币
        return factory.getAllSupportedTokens();
    }
    
    /**
     * @dev 根据给定路径执行交换
     * @param tokenIn 输入代币地址
     * @param amountIn 输入金额
     * @param tokenOut 输出代币地址
     * @param amountOutMin 最小输出金额（滑点保护）
     * @param to 接收输出代币的地址
     * @param deadline 交易截止时间
     * @return amountOut 实际输出金额
     */
    function swapExactTokensForTokens(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(deadline >= block.timestamp, "Expired");
        
        // 找到最佳路径
        (address[] memory path, address[] memory pools) = findBestPath(tokenIn, tokenOut);
        require(path.length >= 2, "Invalid path");
        
        // 将代币从用户转移到路由合约
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "Transfer failed"
        );
        
        // 执行交换
        uint256[] memory amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        
        // 执行所有跳的交换
        for (uint i = 0; i < path.length - 1; i++) {
            address currentPool = pools[i];
            address currentIn = path[i];
            address currentOut = path[i + 1];
            
            // 批准池子合约使用代币
            IERC20(currentIn).approve(currentPool, amounts[i]);
            
            // 执行交换
            amounts[i + 1] = Pool(currentPool).getAmountOut(currentIn, amounts[i], currentOut);
            Pool(currentPool).swap(currentIn, amounts[i], currentOut);
            
            // 检查池子是否实际转移了代币
            require(
                IERC20(currentOut).balanceOf(address(this)) >= amounts[i + 1],
                "Swap failed"
            );
        }
        
        amountOut = amounts[amounts.length - 1];
        
        // 确保满足最小输出金额要求
        require(amountOut >= amountOutMin, "Insufficient output amount");
        
        // 将输出代币发送给接收者
        require(
            IERC20(tokenOut).transfer(to, amountOut),
            "Transfer to recipient failed"
        );
        
        emit SwapRouted(tokenIn, tokenOut, amountIn, amountOut, path);
        
        return amountOut;
    }
    
    /**
     * @dev 获取预期输出金额
     * @param tokenIn 输入代币地址
     * @param amountIn 输入金额
     * @param tokenOut 输出代币地址
     * @return amountOut 预期输出金额
     * @return path 交换路径
     */
    function getAmountsOut(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256 amountOut, address[] memory path) {
        // 找到最佳路径
        (address[] memory bestPath, address[] memory pools) = findBestPath(tokenIn, tokenOut);
        require(bestPath.length >= 2, "No valid path");
        
        uint256[] memory amounts = new uint256[](bestPath.length);
        amounts[0] = amountIn;
        
        // 计算每一跳的输出金额
        for (uint i = 0; i < bestPath.length - 1; i++) {
            address currentPool = pools[i];
            amounts[i + 1] = Pool(currentPool).getAmountOut(bestPath[i], amounts[i], bestPath[i + 1]);
        }
        
        return (amounts[amounts.length - 1], bestPath);
    }
}