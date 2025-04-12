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
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        uint256 midAmount = Pool(firstPool).getAmountOut(tokenIn, amountIn, midToken);
        return Pool(secondPool).getAmountOut(midToken, midAmount, tokenOut);
    }

    /**
     * @dev 获取从tokenIn到tokenOut的最佳路径
     * @param tokenIn 输入代币地址
     * @param tokenOut 输出代币地址
     * @param amountIn 输入金额
     * @return path 最佳交换路径中的代币地址数组
     * @return pools 路径中对应的池子地址数组
     */
    function findBestPath(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (address[] memory path, address[] memory pools) {
        // 记录最佳路径信息
        uint256 bestAmountOut = 0;
        address[] memory bestPath;
        address[] memory bestPools;
        
        // 先检查所有可能的直接路径
        address[] memory directPaths = findDirectPools(tokenIn, tokenOut);
        
        // 计算每条直接路径的输出量，并记录最佳路径
        for (uint i = 0; i < directPaths.length; i++) {
            address directPool = directPaths[i];
            if (directPool != address(0)) {
                uint256 amountOut = Pool(directPool).getAmountOut(tokenIn, amountIn, tokenOut);
                
                if (amountOut > bestAmountOut) {
                    bestAmountOut = amountOut;
                    
                    bestPath = new address[](2);
                    bestPath[0] = tokenIn;
                    bestPath[1] = tokenOut;
                    
                    bestPools = new address[](1);
                    bestPools[0] = directPool;
                }
            }
        }
        
        // 再检查所有可能的多跳路径（通过中间代币）
        address[] memory supportedTokens = getSupportedTokens();
        
        // 尝试通过每个支持的代币作为中间代币
        for (uint i = 0; i < supportedTokens.length; i++) {
            address midToken = supportedTokens[i];
            
            // 跳过输入和输出代币
            if (midToken == tokenIn || midToken == tokenOut) {
                continue;
            }
            
            // 检查第一跳的所有可能池子
            address[] memory firstPools = findDirectPools(tokenIn, midToken);
            // 检查第二跳的所有可能池子  
            address[] memory secondPools = findDirectPools(midToken, tokenOut);
            
            // 尝试所有可能的第一跳和第二跳组合
            for (uint j = 0; j < firstPools.length; j++) {
                for (uint k = 0; k < secondPools.length; k++) {
                    address firstPool = firstPools[j];
                    address secondPool = secondPools[k];
                    
                    if (firstPool != address(0) && secondPool != address(0)) {
                        // 计算此路径的输出金额
                        uint256 amountOut = _calculateMidRouteAmount(
                            firstPool, 
                            secondPool,
                            tokenIn, 
                            midToken, 
                            tokenOut,
                            amountIn
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
     * @dev 查找包含指定两种代币的所有池子
     * @param tokenA 第一个代币地址
     * @param tokenB 第二个代币地址
     * @return pools 包含这两种代币的所有池子地址数组
     */
    function findDirectPools(
        address tokenA, 
        address tokenB
    ) public view returns (address[] memory) {
        // 首先检查简单的两币池
        address[] memory tokensAB = new address[](2);
        tokensAB[0] = tokenA;
        tokensAB[1] = tokenB;
        address directPool = factory.getPool(tokensAB);
        
        // 然后检查是否有三币池包含这两种代币
        address[] memory supportedTokens = getSupportedTokens(); 
        
        // 预分配足够大的数组来存储所有可能的池子
        address[] memory possiblePools = new address[](supportedTokens.length);
        uint256 poolCount = 0;
        
        // 如果两币池存在，添加到结果中
        if (directPool != address(0)) {
            possiblePools[poolCount] = directPool;
            poolCount++;
        }
        
        // 检查所有可能的三币池
        for (uint i = 0; i < supportedTokens.length; i++) {
            address tokenC = supportedTokens[i];
            
            // 跳过tokenA和tokenB
            if (tokenC == tokenA || tokenC == tokenB) {
                continue;
            }
            
            // 检查是否存在包含这三种代币的池子
            address[] memory tokensABC = new address[](3);
            tokensABC[0] = tokenA;
            tokensABC[1] = tokenB;
            tokensABC[2] = tokenC;
            address triPool = factory.getPool(tokensABC);
            
            if (triPool != address(0)) {
                possiblePools[poolCount] = triPool;
                poolCount++;
            }
        }
        
        // 创建确切大小的结果数组
        address[] memory result = new address[](poolCount);
        for (uint i = 0; i < poolCount; i++) {
            result[i] = possiblePools[i];
        }
        
        return result;
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
        (address[] memory path, address[] memory pools) = findBestPath(tokenIn, tokenOut, amountIn);
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
     * @dev 根据用户提供的路径执行交换（链下计算路径版本）
     * @param tokenIn 输入代币地址
     * @param amountIn 输入金额
     * @param amountOutMin 最小输出金额（滑点保护）
     * @param path 交换路径中的代币地址数组
     * @param pools 交换路径中使用的池子地址数组
     * @param to 接收输出代币的地址
     * @param deadline 交易截止时间
     * @return amountOut 实际输出金额
     */
    function swapWithPath(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address[] calldata pools,
        address to,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(deadline >= block.timestamp, "Expired");
        require(path.length >= 2, "Invalid path");
        require(pools.length == path.length - 1, "Invalid pools length");
        require(path[0] == tokenIn, "Invalid path start");
        
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
            
            // 验证池子是否包含这两种代币
            bool isValidPool = _validatePool(currentPool, currentIn, currentOut);
            require(isValidPool, "Invalid pool for tokens");
            
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
            IERC20(path[path.length - 1]).transfer(to, amountOut),
            "Transfer to recipient failed"
        );
        
        emit SwapRouted(tokenIn, path[path.length - 1], amountIn, amountOut, path);
        
        return amountOut;
    }

    /**
     * @dev 验证池子是否支持给定的两种代币交换
     */
    function _validatePool(
        address pool, 
        address tokenA, 
        address tokenB
    ) internal view returns (bool) {
        try Pool(pool).i_tokens_map(tokenA) returns (uint256 indexA) {
            try Pool(pool).i_tokens_map(tokenB) returns (uint256 indexB) {
                return indexA > 0 && indexB > 0; // 都大于0表示两个代币都在池子中
            } catch {
                return false;
            }
        } catch {
            return false;
        }
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
        (address[] memory bestPath, address[] memory pools) = findBestPath(tokenIn, tokenOut, amountIn);
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