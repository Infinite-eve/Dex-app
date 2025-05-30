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
        // 首先尝试直接查找两币池
        address[] memory tokensAB = new address[](2);
        tokensAB[0] = tokenA;
        tokensAB[1] = tokenB;
        address directPool1 = factory.getPool(tokensAB);
        
        // 尝试反向顺序
        address[] memory tokensBA = new address[](2);
        tokensBA[0] = tokenB;
        tokensBA[1] = tokenA;
        address directPool2 = factory.getPool(tokensBA);
        
        // 然后检查是否有三币池包含这两种代币
        address[] memory supportedTokens = getSupportedTokens(); 
        
        // 预分配足够大的数组来存储所有可能的池子
        address[] memory possiblePools = new address[](supportedTokens.length + 2);
        uint256 poolCount = 0;
        
        // 添加找到的两币池
        if (directPool1 != address(0)) {
            possiblePools[poolCount] = directPool1;
            poolCount++;
        }
        if (directPool2 != address(0) && directPool2 != directPool1) {
            possiblePools[poolCount] = directPool2;
            poolCount++;
        }
        
        // 检查所有可能的三币池
        for (uint i = 0; i < supportedTokens.length; i++) {
            address tokenC = supportedTokens[i];
            
            // 跳过tokenA和tokenB
            if (tokenC == tokenA || tokenC == tokenB) {
                continue;
            }
            
            // 尝试不同的代币顺序
            // address[] memory combinations = new address[](6);
            uint256 combinationCount = 0;
            
            // 所有可能的三币组合顺序
            address[][] memory tokenCombinations = new address[][](6);
            
            // ABC 顺序
            address[] memory tokensABC = new address[](3);
            tokensABC[0] = tokenA;
            tokensABC[1] = tokenB;
            tokensABC[2] = tokenC;
            tokenCombinations[combinationCount++] = tokensABC;
            
            // ACB 顺序
            address[] memory tokensACB = new address[](3);
            tokensACB[0] = tokenA;
            tokensACB[1] = tokenC;
            tokensACB[2] = tokenB;
            tokenCombinations[combinationCount++] = tokensACB;
            
            // BAC 顺序
            address[] memory tokensBAC = new address[](3);
            tokensBAC[0] = tokenB;
            tokensBAC[1] = tokenA;
            tokensBAC[2] = tokenC;
            tokenCombinations[combinationCount++] = tokensBAC;
            
            // BCA 顺序
            address[] memory tokensBCA = new address[](3);
            tokensBCA[0] = tokenB;
            tokensBCA[1] = tokenC;
            tokensBCA[2] = tokenA;
            tokenCombinations[combinationCount++] = tokensBCA;
            
            // CAB 顺序
            address[] memory tokensCAB = new address[](3);
            tokensCAB[0] = tokenC;
            tokensCAB[1] = tokenA;
            tokensCAB[2] = tokenB;
            tokenCombinations[combinationCount++] = tokensCAB;
            
            // CBA 顺序
            address[] memory tokensCBA = new address[](3);
            tokensCBA[0] = tokenC;
            tokensCBA[1] = tokenB;
            tokensCBA[2] = tokenA;
            tokenCombinations[combinationCount++] = tokensCBA;
            
            // 尝试所有可能的组合
            for (uint j = 0; j < combinationCount; j++) {
                address triPool = factory.getPool(tokenCombinations[j]);
                
                if (triPool != address(0)) {
                    // 检查这个池子是否已经在结果中
                    bool poolExists = false;
                    for (uint k = 0; k < poolCount; k++) {
                        if (possiblePools[k] == triPool) {
                            poolExists = true;
                            break;
                        }
                    }
                    
                    if (!poolExists) {
                        possiblePools[poolCount] = triPool;
                        poolCount++;
                    }
                    
                    // 找到一个池子后就可以跳出循环了，不需要检查其他组合
                    break;
                }
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
            
            // 获取预期输出金额
            amounts[i + 1] = Pool(currentPool).getAmountOut(currentIn, amounts[i], currentOut);
            
            // 为每一步计算最小输出金额（考虑滑点）
            uint256 minOutForThisStep = i == path.length - 2 
                ? amountOutMin // 最后一步使用用户提供的最小输出金额
                : calculateMinimumAmountOut(amounts[i + 1], 50); // 中间步骤使用0.5%滑点
            
            // 执行带滑点保护的交换
            Pool(currentPool).swap(currentIn, amounts[i], currentOut, minOutForThisStep);
            
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
            
            // 获取预期输出金额
            amounts[i + 1] = Pool(currentPool).getAmountOut(currentIn, amounts[i], currentOut);
            
            // 为每一步计算最小输出金额（考虑滑点）
            uint256 minOutForThisStep = i == path.length - 2 
                ? amountOutMin // 最后一步使用用户提供的最小输出金额
                : calculateMinimumAmountOut(amounts[i + 1], 50); // 中间步骤使用0.5%滑点
            
            // 执行带滑点保护的交换
            Pool(currentPool).swap(currentIn, amounts[i], currentOut, minOutForThisStep);
            
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
    
    /**
     * @dev 计算最小输出金额（考虑滑点）
     * @param amountOut 期望输出金额
     * @param slippageTolerance 滑点容忍度（以基点表示，如100表示1%）
     * @return 考虑滑点后的最小输出金额
     */
    function calculateMinimumAmountOut(
        uint256 amountOut,
        uint256 slippageTolerance
    ) public pure returns (uint256) {
        return amountOut - ((amountOut * slippageTolerance) / 10000);
    }
}