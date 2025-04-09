// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Pool.sol";

contract Factory {
    // 使用排序后的代币数组哈希作为键
    mapping(bytes32 => address) public pools;
    address[] public supportedTokens;
    
    event PoolCreated(
        address[] tokens
    );

    // 创建任意代币数量的流动性池
    function createPool(address[] memory tokens) external returns (address) {
        require(tokens.length >= 2, "At least 2 tokens");
        require(_allUnique(tokens), "Duplicate tokens");
        require(_noZeroAddress(tokens), "Zero address");

        // 生成排序后的代币数组
        address[] memory sortedTokens = _sortTokens(tokens);
        
        // 生成唯一哈希键
        bytes32 poolKey = keccak256(abi.encodePacked(sortedTokens));
        require(pools[poolKey] == address(0), "Pool exists");
        // 创建新池
        address pool = address(new Pool(sortedTokens));
        pools[poolKey] = pool;

        // 维护支持的代币列表
        _updateSupportedTokens(sortedTokens);

        emit PoolCreated(tokens);
        return pool;
    }

    // 获取池地址（任意顺序传入代币）
    function getPool(address[] memory tokens) external view returns (address) {
        bytes32 key = getPoolKey(tokens);
        return pools[key];
    }

    // 获取排序后的池哈希键
    function getPoolKey(address[] memory tokens) public view returns (bytes32) {
        return keccak256(abi.encodePacked(_sortTokens(tokens)));
    }

    // 内部函数：代币排序（使用插入排序）
    function _sortTokens(address[] memory tokens) internal pure returns (address[] memory) {
        address[] memory sorted = _copyArray(tokens);
        
        for (uint i = 1; i < sorted.length; i++) {
            address key = sorted[i];
            uint j = i;
            while (j > 0 && uint160(sorted[j-1]) > uint160(key)) {
                sorted[j] = sorted[j-1];
                j--;
            }
            sorted[j] = key;
        }
        return sorted;
    }

    // 内部函数：更新支持的代币列表
    function _updateSupportedTokens(address[] memory newTokens) internal {
        for (uint i = 0; i < newTokens.length; i++) {
            if (!_isTokenSupported(newTokens[i])) {
                supportedTokens.push(newTokens[i]);
            }
        }
    }

    // 辅助函数：复制数组
    function _copyArray(address[] memory arr) internal pure returns (address[] memory) {
        address[] memory copy = new address[](arr.length);
        for (uint i = 0; i < arr.length; i++) {
            copy[i] = arr[i];
        }
        return copy;
    }

    // 检查代币是否已支持
    function _isTokenSupported(address token) internal view returns (bool) {
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                return true;
            }
        }
        return false;
    }

    // 检查地址数组是否全非零（保持原有实现）
    function _noZeroAddress(address[] memory tokens) internal pure returns (bool) {
        for (uint i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) return false;
        }
        return true;
    }

    // 检查地址数组是否全唯一（优化版）
    function _allUnique(address[] memory tokens) internal pure returns (bool) {
        if (tokens.length <= 1) return true;
        for (uint i = 0; i < tokens.length - 1; i++) {
            for (uint j = i + 1; j < tokens.length; j++) {
                if (tokens[i] == tokens[j]) return false;
            }
        }
        return true;
    }
}