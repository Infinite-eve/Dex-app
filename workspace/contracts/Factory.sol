// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Pool.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Factory is Ownable {
    // 使用排序后的代币数组哈希作为键
    mapping(bytes32 => address) public pools;
    address[] public supportedTokens;
    
    // 滑点相关常量
    uint256 public constant MIN_SLIPPAGE = 10; // 0.1%
    uint256 public constant MAX_SLIPPAGE = 1000; // 10%
    
    event PoolCreated(
        address poolAddress,
        address[] tokens
    );

    // 全局滑点控制相关变量
    uint256 public globalMaxSlippage = 500; // 默认5%
    mapping(address => uint256) public poolMaxSlippage; // 各池子的滑点限制
    mapping(address => uint256) public tokenMaxSlippage; // 各代币的滑点限制

    // 滑点相关事件
    event GlobalSlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    event PoolSlippageUpdated(address indexed pool, uint256 oldSlippage, uint256 newSlippage);
    event TokenSlippageUpdated(address indexed token, uint256 oldSlippage, uint256 newSlippage);

    constructor() Ownable(msg.sender) {}

    // 内部函数：根据代币数组获取池子地址
    function _getPool(address[] memory tokens) internal view returns (address) {
        bytes32 poolKey = keccak256(abi.encodePacked(tokens));
        return pools[poolKey];
    }

    // 创建任意代币数量的流动性池
    function createPool(address[] memory tokens) external returns (address) {
        require(tokens.length >= 2, "At least 2 tokens");
        require(_allUnique(tokens), "Duplicate tokens");
        require(_noZeroAddress(tokens), "Zero address");

        // 生成排序后的代币数组
        // address[] memory sortedTokens = tokens;
        
        // 生成唯一哈希键
        bytes32 poolKey = keccak256(abi.encodePacked(tokens));
        require(pools[poolKey] == address(0), "Pool exists");
        // 创建新池
        address pool = address(new Pool(tokens));
        pools[poolKey] = pool;

        // 维护支持的代币列表
        _updateSupportedTokens(tokens);

        emit PoolCreated(pool, tokens);
        return pool;
    }

    // 获取池地址（任意顺序传入代币）
    function getPool(address[] memory tokens) external view returns (address) {
        bytes32 key = getPoolKey(tokens);
        return pools[key];
    }

    // 获取排序后的池哈希键
    function getPoolKey(address[] memory tokens) public pure returns (bytes32) {
        return keccak256(abi.encodePacked((tokens)));
    }
    
    // 获取支持的代币数量
    function getSupportedTokensCount() external view returns (uint256) {
        return supportedTokens.length;
    }
    
    // 获取所有支持的代币
    function getAllSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
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

    // 设置全局最大滑点
    function setGlobalMaxSlippage(uint256 _maxSlippage) external onlyOwner {
        require(_maxSlippage <= MAX_SLIPPAGE, "Max slippage too high");
        require(_maxSlippage >= MIN_SLIPPAGE, "Max slippage too low");
        
        uint256 oldSlippage = globalMaxSlippage;
        globalMaxSlippage = _maxSlippage;
        
        emit GlobalSlippageUpdated(oldSlippage, _maxSlippage);
    }

    // 设置特定池子的滑点限制
    function setPoolMaxSlippage(address poolAddress, uint256 _maxSlippage) external onlyOwner {
        require(pools[getPoolKey(_getPoolTokens(poolAddress))] == poolAddress, "Invalid pool");
        require(_maxSlippage <= globalMaxSlippage, "Slippage exceeds global limit");
        require(_maxSlippage >= MIN_SLIPPAGE, "Max slippage too low");
        
        uint256 oldSlippage = poolMaxSlippage[poolAddress];
        poolMaxSlippage[poolAddress] = _maxSlippage;
        Pool(poolAddress).setMaxSlippage(_maxSlippage);
        
        emit PoolSlippageUpdated(poolAddress, oldSlippage, _maxSlippage);
    }

    // 设置特定代币的滑点限制
    function setTokenMaxSlippage(address token, uint256 _maxSlippage) external onlyOwner {
        require(_maxSlippage <= globalMaxSlippage, "Slippage exceeds global limit");
        require(_maxSlippage >= MIN_SLIPPAGE, "Max slippage too low");
        
        uint256 oldSlippage = tokenMaxSlippage[token];
        tokenMaxSlippage[token] = _maxSlippage;
        
        // 更新所有包含该代币的池子
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                address[] memory poolTokens = new address[](2);
                poolTokens[0] = token;
                poolTokens[1] = supportedTokens[(i + 1) % supportedTokens.length];
                address pool = _getPool(poolTokens);
                if (pool != address(0)) {
                    Pool(pool).setTokenMaxSlippage(token, _maxSlippage);
                }
            }
        }
        
        emit TokenSlippageUpdated(token, oldSlippage, _maxSlippage);
    }

    // 获取池子的代币列表
    function _getPoolTokens(address poolAddress) internal view returns (address[] memory) {
        Pool pool = Pool(poolAddress);
        uint256 length = pool.getTokensLength();  // 使用新的函数获取长度
        address[] memory tokens = new address[](length);
        for (uint i = 0; i < length; i++) {
            tokens[i] = pool.i_tokens_addresses(i);
        }
        return tokens;
    }
}