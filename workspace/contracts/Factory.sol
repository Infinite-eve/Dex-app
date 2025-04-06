// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Pool.sol";

contract Factory {
    // 记录所有已创建的池子
    // 使用嵌套映射来存储三种代币的池子
    mapping(address => mapping(address => mapping(address => address))) public pools;
    // 支持的代币列表
    address[] public supportedTokens;
    
    event PoolCreated(address indexed token0, address indexed token1, address indexed token2, address pool);
    
    // 创建新的流动性池
    function createPool(address tokenA, address tokenB, address tokenC) external returns (address) {
        require(tokenA != tokenB && tokenA != tokenC && tokenB != tokenC, "Same tokens");
        require(tokenA != address(0) && tokenB != address(0) && tokenC != address(0), "Zero address");
        
        // 确保 token0 < token1 < token2，这样可以避免重复创建池子
        address token0;
        address token1;
        address token2;
        
        // 对三个代币进行排序
        if (tokenA < tokenB) {
            if (tokenA < tokenC) {
                token0 = tokenA;
                if (tokenB < tokenC) {
                    token1 = tokenB;
                    token2 = tokenC;
                } else {
                    token1 = tokenC;
                    token2 = tokenB;
                }
            } else {
                token0 = tokenC;
                token1 = tokenA;
                token2 = tokenB;
            }
        } else {
            if (tokenB < tokenC) {
                token0 = tokenB;
                if (tokenA < tokenC) {
                    token1 = tokenA;
                    token2 = tokenC;
                } else {
                    token1 = tokenC;
                    token2 = tokenA;
                }
            } else {
                token0 = tokenC;
                token1 = tokenB;
                token2 = tokenA;
            }
        }
            
        require(pools[token0][token1][token2] == address(0), "Pool exists");
        
        // 创建新的池子
        address pool = address(new Pool(token0, token1, token2));
        
        // 记录池子地址 - 所有可能的排列
        pools[token0][token1][token2] = pool;
        pools[token0][token2][token1] = pool;
        pools[token1][token0][token2] = pool;
        pools[token1][token2][token0] = pool;
        pools[token2][token0][token1] = pool;
        pools[token2][token1][token0] = pool;
        
        // 如果是新代币，添加到支持的代币列表中
        if (!isTokenSupported(token0)) {
            supportedTokens.push(token0);
        }
        if (!isTokenSupported(token1)) {
            supportedTokens.push(token1);
        }
        if (!isTokenSupported(token2)) {
            supportedTokens.push(token2);
        }
        
        emit PoolCreated(token0, token1, token2, pool);
        return pool;
    }
    
    // 获取池子地址
    function getPool(address tokenA, address tokenB, address tokenC) external view returns (address) {
        return pools[tokenA][tokenB][tokenC];
    }
    
    // 获取支持的代币数量
    function getSupportedTokensLength() external view returns (uint256) {
        return supportedTokens.length;
    }
    
    // 检查代币是否已支持
    function isTokenSupported(address token) public view returns (bool) {
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                return true;
            }
        }
        return false;
    }
}