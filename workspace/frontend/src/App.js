import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

/* User Interface */
import Logo from "./assets/icons/currency-exchange.svg"
import { Card, Tabs, Tab, Row, Col, Form, Button, Container, Badge, Table, Dropdown } from 'react-bootstrap';

/* Interaction with Backend */
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';  // Import ethers.js library
import { getAmountOut, getContracts, getPoolInfo, getTokenBalances, getRequiredAmounts, swapTokens, addLiquidity, withdrawLiquidity, getLPTokenInfo, getAvailablePools, getPoolFees, getClaimableRewards, claimLpIncentives, getSmartAmountOut, smartSwapTokens, getPathInfo } from './utils/contract';      // Import helper functions

// 添加格式化数字的辅助函数
const formatNumber = (number) => {
  if (!number || isNaN(number)) return '0.00';
  // 确保number是数字类型
  const num = typeof number === 'string' ? parseFloat(number) : number;
  if (isNaN(num)) return '0.00';
  // 处理非常小的数字，使用科学计数法
  if (num < 0.000001 && num > 0) {
    return num.toExponential(6);
  }
  // 正常数字保留2位小数
  return num.toFixed(2);
};

function App() {
  /* wallet related */
  const [isWalletConnected, setIsWalletConnected] = useState(false); // Track wallet connection
  const [account, setAccount] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [provider, setProvider] = useState(null);
  
  /* pool related */
  const [poolList, setPoolList] = useState([]);
  const [selectedPoolId, setSelectedPoolId] = useState('pool1');

  // 添加新的状态变量
  const [rewardAmounts, setRewardAmounts] = useState({ token0: '', token1: '', token2: '' });
  const [routingPath, setRoutingPath] = useState([]); // 智能路由的路径信息

  /* balance related */
  const [balance0, setBalance0] = useState(0);
  const [balance1, setBalance1] = useState(0);
  const [balance2, setBalance2] = useState(0);
  const [poolInfo, setPoolInfo] = useState({ token0Balance: '0', token1Balance: '0', token2Balance: '0' });
  const [lpInfo, setLpInfo] = useState({ totalSupply: '0', userBalance: '0' });
  const [poolFees, setPoolFees] = useState({ token0Fee: '0', token1Fee: '0', token2Fee: '0' });
  const [claimableRewards, setClaimableRewards] = useState({ token0: '0', token1: '0', token2: '0' });

  /* swap related */
  // Update state to handle different token selections per pool
  const [availableTokensInPool, setAvailableTokensInPool] = useState([]);
  const [fromToken, setFromToken] = useState('token0');
  const [toToken, setToToken] = useState('token1');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  
  /* 添加独立的 Smart Swap 币种选择器状态 */
  const [smartFromToken, setSmartFromToken] = useState('token0');
  const [smartToToken, setSmartToToken] = useState('token1');
  const [smartFromAmount, setSmartFromAmount] = useState('');
  const [smartToAmount, setSmartToAmount] = useState('');

  /* add liquidity related */
  const [liquidityAmounts, setLiquidityAmounts] = useState({
    token0: '',
    token1: '',
    token2: ''
  });

  /* withdraw liquidity related */
  const [lpTokenAmount, setLpTokenAmount] = useState('');

  // 所有支持的代币
  const supportedTokens = ['ALPHA', 'BETA', 'GAMMA'];

  // 添加滑点状态变量
  const [slippage, setSlippage] = useState(500); // 默认5%滑点

  // Effect to fetch available pools when component loads
  useEffect(() => {
    const pools = getAvailablePools();
    setPoolList(pools);
  }, []);

  // Effect to update token selection when selected pool changes
  useEffect(() => {
    if (contracts && contracts.tokensInPool) {
      setAvailableTokensInPool(contracts.tokensInPool);
      // Reset token selections to valid values for this pool
      if (contracts.tokensInPool.length >= 2) {
        setFromToken(contracts.tokensInPool[0]);
        setToToken(contracts.tokensInPool[1]);
      }
      
      // Reset liquidity amounts
      const newLiquidityAmounts = {};
      contracts.tokensInPool.forEach(token => {
        newLiquidityAmounts[token] = '';
      });
      setLiquidityAmounts(newLiquidityAmounts);
    }
  }, [contracts]);

  // Function to handle pool selection
  const handlePoolSelect = async (poolId) => {
    if (poolId === selectedPoolId) return;
    
    setSelectedPoolId(poolId);
    
    // Reset amounts
    setFromAmount('');
    setToAmount('');
    setLpTokenAmount('');
    
    // If already connected, update contracts for the new pool
    if (isWalletConnected && provider) {
      const signer = await provider.getSigner();
      const newContracts = await getContracts(signer, poolId);
      setContracts(newContracts);
      await updatePoolAndBalances(newContracts);
    }
  };


  // switch token button
  const handleTokenSwitch = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount('');
    setToAmount('');
  };

  const calculateOutputAmount = async (inputAmount, tokenIn, tokenOut) => {
    if (!inputAmount || !contracts || !tokenIn || !tokenOut) {
      return '0';
    }

    try {
      const result = await getAmountOut(
        contracts,
        tokenIn,
        inputAmount,
        tokenOut
      );
      return result;
    } catch (error) {
      console.error("Error calculating output amount:", error);
      return '0';
    }
  };

  const handleFromAmountChange = async (e) => {
    const value = e.target.value;
    setFromAmount(value);

    if (value && !isNaN(value)) {
      const output = await calculateOutputAmount(value, fromToken, toToken);
      setToAmount(output);
    } else {
      setToAmount('');
    }
  };

  const handleLiquidityAmountChange = async (tokenKey, value) => {
    // 只处理第一个代币的输入
    if (tokenKey === contracts.tokensInPool[0]) {
      setLiquidityAmounts({
        ...liquidityAmounts,
        [tokenKey]: value
      });

      // 如果有输入值，计算其他代币的数量
      if (value && !isNaN(value)) {
        const otherAmounts = await calculateTokenAmounts(contracts, value);
        const newAmounts = { ...liquidityAmounts };
        newAmounts[tokenKey] = value;
        
        // 更新其他代币的数量，并格式化为2位小数
        contracts.tokensInPool.slice(1).forEach((token, index) => {
          const amount = parseFloat(otherAmounts[index]);
          newAmounts[token] = isNaN(amount) ? '0.00' : amount.toFixed(2);
        });
        
        setLiquidityAmounts(newAmounts);
      }
    }
  };

  const calculateTokenAmounts = async (contracts, amount0) => {
    if (!amount0 || !contracts || isNaN(amount0) || amount0 <= 0) {
      return ['0', '0'];
    }
    try {
      console.log(amount0);
      const result = await getRequiredAmounts(contracts, amount0);
      const subArray = result.slice(1);
      console.log(subArray);
      return subArray.map(item => {
        // 检查是否是 BigNumber 类型
        if (item && typeof item === 'object' && 'toBigInt' in item) {
          return ethers.formatEther(item);
        }
        // 如果 item 是数字或字符串，先转换为 BigNumber
        try {
          const bigNumber = ethers.parseUnits(item.toString(), 18);

          return ethers.formatEther(bigNumber);
        } catch (error) {
          console.error("Error formatting number:", error);
          return "0";
        }
      });
    } catch (error) {
      console.error("Error calculating token amounts:", error);
      return ['0', '0'];
    }
  };



  const updatePoolAndBalances = async (currentContracts) => {

    // 
    if (!currentContracts) {
      const signer = await provider.getSigner();
      currentContracts = await getContracts(signer, selectedPoolId);
    }
    console.log("selectedPoolId:",selectedPoolId)
    // 获取用户代币余额
    const balances = await getTokenBalances(currentContracts, account);
    setBalance0(balances.token0);
    setBalance1(balances.token1);
    setBalance2(balances.token2);

    // 获取池子信息
    const info = await getPoolInfo(currentContracts);
    setPoolInfo(info);

    // 获取LP token信息
    const lpTokenInfo = await getLPTokenInfo(currentContracts, account);
    setLpInfo(lpTokenInfo);
    
    // 获取累积手续费
    const fees = await getPoolFees(currentContracts);
    setPoolFees(fees);
    
    // 获取用户可领取的奖励
    const rewards = await getClaimableRewards(currentContracts, account);
    setClaimableRewards(rewards);
  };

  const handleConnectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not installed");
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      // 先设置合约，使用当前选择的池子
      const initializedContracts = await getContracts(signer, selectedPoolId);
      console.log("Contracts initialized");

      // 设置状态
      setProvider(provider);
      setAccount(accounts[0]);
      setContracts(initializedContracts);
      setIsWalletConnected(true);

      // 立即获取余额信息
      const balances = await getTokenBalances(initializedContracts, accounts[0]);
      console.log("Token balances:", balances);
      setBalance0(balances.token0);
      setBalance1(balances.token1);
      setBalance2(balances.token2);

      // 获取池子信息
      const info = await getPoolInfo(initializedContracts);
      console.log("Pool info:", info);
      setPoolInfo(info);

      // 获取LP token信息
      const lpTokenInfo = await getLPTokenInfo(initializedContracts, accounts[0]);
      console.log("LP token info:", lpTokenInfo);
      setLpInfo(lpTokenInfo);

      alert(`Wallet connected!`);
    } catch (error) {
      console.error("Detailed connection error:", error);
      alert(`Failed to connect: ${error.message}`);
    }
  };

  const handleSwap = async () => {
    try {
      if (!contracts || !account) {
        alert("Please connect your wallet first");
        return;
      }

      const tokenIn = fromToken;
      const tokenOut = toToken;
      const amountIn = parseFloat(fromAmount);

      if (isNaN(amountIn) || amountIn <= 0) {
        alert("Please enter a valid input amount");
        return;
      }

      // 获取预期输出数量
      const expectedAmountOut = await getAmountOut(contracts, tokenIn, amountIn, tokenOut);
      const expectedAmountOutNum = parseFloat(expectedAmountOut);

      // 使用用户设置的滑点值
      const tx = await swapTokens(contracts, tokenIn, amountIn, tokenOut, slippage);
      await tx.wait();

      // 更新余额
      await updatePoolAndBalances(contracts);
      alert("Swap successful!");
    } catch (error) {
      console.error("Error in swap:", error);
      if (error.message.includes("Slippage too high")) {
        alert("Slippage too high, please adjust slippage settings or try again later");
      } else if (error.message.includes("Insufficient")) {
        alert("Insufficient balance, please check your token balances");
      } else if (error.message.includes("Transfer")) {
        alert("Token transfer failed, please check authorization status");
      } else {
        alert("Swap failed: " + error.message);
      }
    }
  };

  const handleAddLiquidity = async () => {
    try {
      if (!contracts || !account) {
        throw new Error("Contracts or account not initialized");
      }

      // Only use the amounts for tokens that are in this pool
      const filteredAmounts = {};
      contracts.tokensInPool.forEach(tokenKey => {
        if (liquidityAmounts[tokenKey]) {
          filteredAmounts[tokenKey] = liquidityAmounts[tokenKey];
        }
      });

      await addLiquidity(contracts, filteredAmounts);

      // 更新所有信息
      await updatePoolAndBalances();

      // Reset input fields
      setLiquidityAmounts(prev => {
        const newAmounts = {...prev};
        Object.keys(newAmounts).forEach(key => {
          newAmounts[key] = '';
        });
        return newAmounts;
      });

      alert("Liquidity added successfully!");
    } catch (error) {
      console.error("Detailed error:", error);
      alert(`Failed to add liquidity: ${error.message}`);
    }
  };

  const handleWithdrawLiquidity = async () => {
    try {
      if (!contracts || !account) {
        throw new Error("Contracts or account not initialized");
      }

      if (!lpTokenAmount) {
        throw new Error("Please enter valid LP token amount");
      }

      await withdrawLiquidity(contracts, lpTokenAmount);

      // 清空输入框
      setLpTokenAmount('');

      // 更新所有信息
      await updatePoolAndBalances();

      alert("Liquidity withdrawn successfully!");
    } catch (error) {
      console.error("Detailed error:", error);
      alert(`Failed to withdraw liquidity: ${error.message}`);
    }
  };

  const handleClaimRewards = async (tokenAddress, tokenKey, amount) => {
    try {
      if (!contracts || !account) return;
      
      // 如果没有提供数量或数量为0，则使用全部可用数量
      const claimAmount = !amount || amount === '' 
        ? 0  // 在合约中 0 表示提取全部
        : amount;
      
      // 调用修改后的合约函数
      await claimLpIncentives(contracts, tokenAddress, claimAmount);
      
      // 重置输入字段
      setRewardAmounts(prev => ({
        ...prev,
        [tokenKey]: ''
      }));
      
      // 更新所有信息
      await updatePoolAndBalances();
      
      // 显示成功消息
      alert('Rewards claimed successfully!');
    } catch (error) {
      console.error(error);
      alert(`Failed to claim rewards: ${error.message}`);
    }
  };

  // 一键提取所有代币的奖励
  const handleClaimAllRewards = async () => {
    try {
      if (!contracts || !account) return;
      
      if (parseFloat(claimableRewards.token0) > 0) {
        await claimLpIncentives(contracts, contracts.token0.address, 0);
      }
      
      if (parseFloat(claimableRewards.token1) > 0) {
        await claimLpIncentives(contracts, contracts.token1.address, 0);
      }
      
      if (parseFloat(claimableRewards.token2) > 0) {
        await claimLpIncentives(contracts, contracts.token2.address, 0);
      }
      
      // 更新所有信息
      await updatePoolAndBalances();
      
      // 显示成功消息
      alert('All rewards claimed successfully!');
    } catch (error) {
      console.error(error);
      alert(`Failed to claim all rewards: ${error.message}`);
    }
  };

  // 处理智能交换输入变化
  const handleSmartFromAmountChange = async (e) => {
    const value = e.target.value;
    setSmartFromAmount(value);

    if (value && !isNaN(value)) {
      try {
        // 使用Router获取智能路由的数量预估
        const { amountOut, path, pools } = await getSmartAmountOut(contracts, smartFromToken, value, smartToToken);
        setSmartToAmount(amountOut);
        
        // 获取并设置路径信息，用于显示
        if (path && path.length > 0) {
          const pathInfo = await getPathInfo(contracts, path, pools);
          setRoutingPath(pathInfo);
        }
      } catch (error) {
        console.error("Error calculating smart output:", error);
        setSmartToAmount('0');
      }
    } else {
      setSmartToAmount('');
      setRoutingPath([]);
    }
  };

  // 执行智能交换
  const handleSmartSwap = async () => {
    try {
      if (!contracts || !account) {
        alert("Please connect your wallet first");
        return;
      }

      const tokenIn = smartFromToken;
      const tokenOut = smartToToken;
      const amountIn = parseFloat(smartFromAmount);

      if (isNaN(amountIn) || amountIn <= 0) {
        alert("Please enter a valid input amount");
        return;
      }

      // 执行智能交换
      const tx = await smartSwapTokens(
        contracts, 
        tokenIn, 
        amountIn, 
        tokenOut, 
        slippage, 
        account
      );
      
      await tx.wait();

      // 重置输入
      setSmartFromAmount('');
      setSmartToAmount('');
      setRoutingPath([]);
      
      // 更新余额
      await updatePoolAndBalances(contracts);
      alert("Smart Swap successful!");
    } catch (error) {
      console.error("Error in smart swap:", error);
      if (error.message.includes("Slippage too high")) {
        alert("Slippage too high, please adjust slippage settings or try again later");
      } else if (error.message.includes("Insufficient")) {
        alert("Insufficient balance, please check your token balances");
      } else {
        alert("Smart Swap failed: " + error.message);
      }
    }
  };

  return (
    <div className="container py-5">
      <nav className="bg-light py-3 shadow-sm"> 
        <Container>
          <Row className="justify-content-center align-items-center g-0">
            <Col className="col-auto"> 
              <div className="d-flex align-items-center justify-content-center"> 
                <img
                  src={Logo}
                  alt="Logo"
                  width="36"
                  height="36"
                  className="me-2"
                />
                <span className="h4 mb-0 text-primary">DEX APP</span>
              </div>
            </Col>

            {/* Pool selector */}
            <Col className="col-auto ms-3">
              <Dropdown>
                <Dropdown.Toggle variant="outline-primary" id="dropdown-pools">
                  {poolList.find(p => p.id === selectedPoolId)?.pair || 'Select Pool'}
                </Dropdown.Toggle>
                
                <Dropdown.Menu>
                  {poolList.map(pool => (
                    <Dropdown.Item 
                      key={pool.id} 
                      onClick={() => handlePoolSelect(pool.id)}
                      active={pool.id === selectedPoolId}
                    >
                      {pool.pair}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Col>

            {/* 右侧 - 钱包连接按钮 */}
            <Col className="col-auto ms-auto"> 
              {isWalletConnected ? (
                <div className="d-flex align-items-center gap-2">
                  <Badge pill bg="secondary" className="fs-6 py-2">
                    {`${account?.slice(0, 6)}...${account?.slice(-4)}`}
                  </Badge>
                  <Button 
                    variant="outline-primary"
                    onClick={() => updatePoolAndBalances()}
                    size="sm"
                  >
                    <i className="bi bi-arrow-clockwise"></i> Refresh
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleConnectWallet}
                  size="lg"
                  className="px-4"
                >
                  Connect Wallet
                </Button>
              )}
            </Col>
          </Row>
        </Container>
      </nav>
      
      {/* 个人账户余额 */}
      <Row className="mb-4">
        <Col md={2} className="mb-3">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="Card-title">Balances</Card.Title>
              <Card.Text>ALPHA: {formatNumber(balance0)} </Card.Text>
              <Card.Text>BETA: {formatNumber(balance1)} </Card.Text>
              <Card.Text>GAMMA: {formatNumber(balance2)} </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        
        {/* PoolList */}
        <Col md={10} className="mb-3">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="Card-title">Pool Information</Card.Title>
              <Table striped bordered hover>
                <thead>
                  <tr className="table-primary">
                    <th colSpan="8">Basic Pool Information</th>
                    <th colSpan="2">User Holder</th>
                  </tr>
                  <tr>
                    <th>Pool</th>
                    <th>Pair</th>
                    <th>ALPHA Balance</th>
                    <th>BETA Balance</th>
                    <th>GAMMA Balance</th>
                    <th>Total LP Tokens</th>
                    <th>Fee</th>
                    <th>lpFees</th>
                    <th>User Total Value</th>
                    <th>Share Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{selectedPoolId}</td>
                    <td>{contracts?.poolData?.pair || "-"}</td>
                    <td>{contracts?.tokensInPool?.includes("token0") ? formatNumber(poolInfo.token0Balance) : "-"}</td>
                    <td>{contracts?.tokensInPool?.includes("token1") ? formatNumber(poolInfo.token1Balance) : "-"}</td>
                    <td>{contracts?.tokensInPool?.includes("token2") ? formatNumber(poolInfo.token2Balance) : "-"}</td>
                    <td>{formatNumber(lpInfo.totalSupply)}</td>
                    <td>0.3%</td>
                    <td>
                        <div>ALPHA: {formatNumber(poolFees.token0Fee)}</div>
                        <div>BETA: {formatNumber(poolFees.token1Fee)}</div>
                        <div>GAMMA: {formatNumber(poolFees.token2Fee)}</div>
                        </td>
                    <td>{formatNumber(lpInfo.userBalance)}</td>
                    <td>{lpInfo.percentage}%</td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <Tabs defaultActiveKey="swap" className="mb-3">
            <Tab eventKey="swap" title="Swap">
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>From</Form.Label>
                  <div className="d-flex">
                    <Form.Control
                      type="number"
                      value={fromAmount}
                      onChange={handleFromAmountChange}
                      placeholder="0.00"
                      step="0.01"
                      className="me-2"
                    />
                    <Form.Select
                      value={fromToken}
                      onChange={(e) => setFromToken(e.target.value)}
                      style={{ width: '120px' }}
                    >
                      {availableTokensInPool.map(tokenKey => (
                        tokenKey !== toToken && (
                          <option key={tokenKey} value={tokenKey}>
                            {contracts?.tokenMapping[tokenKey]?.symbol || tokenKey}
                          </option>
                        )
                      ))}
                    </Form.Select>
                  </div>
                </Form.Group>

                <div className="text-center my-3">
                  <Button variant="outline-secondary" onClick={handleTokenSwitch}>
                    ↑↓
                  </Button>
                </div>

                <Form.Group className="mb-3">
                  <Form.Label>To</Form.Label>
                  <div className="d-flex">
                    <Form.Control
                      type="number"
                      value={formatNumber(toAmount)}
                      readOnly
                      placeholder="0.00"
                      className="me-2"
                    />
                    <Form.Select
                      value={toToken}
                      onChange={(e) => setToToken(e.target.value)}
                      style={{ width: '120px' }}
                    >
                      {availableTokensInPool.map(tokenKey => (
                        tokenKey !== fromToken && (
                          <option key={tokenKey} value={tokenKey}>
                            {contracts?.tokenMapping[tokenKey]?.symbol || tokenKey}
                          </option>
                        )
                      ))}
                    </Form.Select>
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Slippage Tolerance</Form.Label>
                  <div className="d-flex align-items-center">
                    <Form.Control
                      type="number"
                      value={slippage / 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0.1 && value <= 10) {
                          setSlippage(value * 100);
                        }
                      }}
                      placeholder="0.5"
                      step="0.1"
                      min="0.1"
                      max="5"
                      style={{ width: '100px' }}
                    />
                    <span className="ms-2">%</span>
                  </div>
                  <Form.Text className="text-muted">
                    Your transaction will revert if the price changes unfavorably by more than this percentage.
                  </Form.Text>
                </Form.Group>

                {fromAmount && parseFloat(fromAmount) > 0 && (
                  <div className="text-muted mb-3">
                    <small>
                      Fee: {formatNumber(parseFloat(fromAmount) * 0.003)} {fromToken} (0.3%)
                    </small>
                  </div>
                )}

                <Button
                  variant="primary"
                  onClick={handleSwap}
                  disabled={!isWalletConnected || !fromAmount || fromAmount <= 0}
                >
                  Swap
                </Button>
              </Form>
            </Tab>

            {/* 新增 Smart Swap 标签页 */}
            <Tab eventKey="smartSwap" title="Smart Swap">
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>From</Form.Label>
                  <div className="d-flex">
                    <Form.Control
                      type="number"
                      value={smartFromAmount}
                      onChange={handleSmartFromAmountChange}
                      placeholder="0.00"
                      step="0.01"
                      className="me-2"
                    />
                    <Form.Select
                      value={smartFromToken}
                      onChange={(e) => {
                        setSmartFromToken(e.target.value);
                        setSmartFromAmount('');
                        setSmartToAmount('');
                        setRoutingPath([]);
                      }}
                      style={{ width: '120px' }}
                    >
                      {supportedTokens.map((token, index) => (
                        token !== supportedTokens[parseInt(smartToToken.replace('token', ''))] && (
                          <option key={index} value={`token${index}`}>
                            {token}
                          </option>
                        )
                      ))}
                    </Form.Select>
                  </div>
                </Form.Group>

                <div className="text-center my-3">
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => {
                      const tempToken = smartFromToken;
                      setSmartFromToken(smartToToken);
                      setSmartToToken(tempToken);
                      setSmartFromAmount('');
                      setSmartToAmount('');
                      setRoutingPath([]);
                    }}
                  >
                    ↑↓
                  </Button>
                </div>

                <Form.Group className="mb-3">
                  <Form.Label>To</Form.Label>
                  <div className="d-flex">
                    <Form.Control
                      type="number"
                      value={formatNumber(smartToAmount)}
                      readOnly
                      placeholder="0.00"
                      className="me-2"
                    />
                    <Form.Select
                      value={smartToToken}
                      onChange={(e) => {
                        setSmartToToken(e.target.value);
                        setSmartFromAmount('');
                        setSmartToAmount('');
                        setRoutingPath([]);
                      }}
                      style={{ width: '120px' }}
                    >
                      {supportedTokens.map((token, index) => (
                        token !== supportedTokens[parseInt(smartFromToken.replace('token', ''))] && (
                          <option key={index} value={`token${index}`}>
                            {token}
                          </option>
                        )
                      ))}
                    </Form.Select>
                  </div>
                </Form.Group>

                {/* 添加滑点设置 */}
                <Form.Group className="mb-3">
                  <Form.Label>Slippage Tolerance: {slippage/100}%</Form.Label>
                  <div className="d-flex align-items-center">
                    <Form.Range 
                      value={slippage}
                      onChange={(e) => setSlippage(parseInt(e.target.value))}
                      min="10"
                      max="1000"
                      step="10"
                      className="me-2 flex-grow-1"
                    />
                    <div className="text-muted" style={{width: '60px'}}>
                      {slippage/100}%
                    </div>
                  </div>
                  <div className="d-flex mt-2 gap-2">
                    <Button size="sm" variant="outline-secondary" onClick={() => setSlippage(50)}>0.5%</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => setSlippage(100)}>1%</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => setSlippage(300)}>3%</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => setSlippage(500)}>5%</Button>
                  </div>
                </Form.Group>

                {/* 显示路由信息 */}
                <Card className="bg-light mb-3">
                  <Card.Body>
                    <Card.Title className="fs-6">Routing</Card.Title>
                    <div className="d-flex align-items-center flex-wrap">
                      {/* 如果有路由信息，显示完整路径 */}
                      {routingPath.length > 0 ? (
                        <>
                          {routingPath.map((token, index) => (
                            <React.Fragment key={index}>
                              <Badge bg={index === 0 ? "primary" : (index === routingPath.length - 1 ? "success" : "secondary")} className="me-2">
                                {token.symbol}
                              </Badge>

                              {/* 显示池子信息（如果有） */}
                              {index < routingPath.length - 1 && token.pool && (
                                <div className="d-inline-flex align-items-center">
                                  <i className="bi bi-arrow-right mx-1"></i>
                                  <Badge bg="info" pill className="small mx-1">
                                    via {token.pool.pair || token.pool.id}
                                  </Badge>
                                  <i className="bi bi-arrow-right mx-1"></i>
                                </div>
                              )}
                              
                              {/* 如果只有代币路径没有池子信息，则显示简单箭头 */}
                              {index < routingPath.length - 1 && !token.pool && (
                                <i className="bi bi-arrow-right mx-2"></i>
                              )}
                            </React.Fragment>
                          ))}
                        </>
                      ) : (
                        <>
                          {/* 没有路由信息时显示简单路径 */}
                          <Badge bg="primary" className="me-2">
                            {supportedTokens[parseInt(smartFromToken.replace('token', ''))]}
                          </Badge>
                          <i className="bi bi-arrow-right mx-2"></i>
                          <Badge bg="success" className="me-2">
                            {supportedTokens[parseInt(smartToToken.replace('token', ''))]}
                          </Badge>
                        </>
                      )}
                    </div>
                    
                    {routingPath.length > 2 && (
                      <div className="mt-2 small text-info">
                        <i className="bi bi-info-circle me-1"></i>
                        Smart Swap has found a better route through intermediate tokens.
                      </div>
                    )}
                    
                    <div className="mt-2 text-muted small">
                      Estimated output with {slippage/100}% slippage: {formatNumber(smartToAmount * (1 - slippage/10000))} {supportedTokens[parseInt(smartToToken.replace('token', ''))]}
                    </div>
                  </Card.Body>
                </Card>

                <Button
                  variant="primary"
                  onClick={handleSmartSwap}
                  disabled={!isWalletConnected || !smartFromAmount || smartFromAmount <= 0}
                >
                  Smart Swap
                </Button>
              </Form>
            </Tab>

            <Tab eventKey="liquidity" title="Add Liquidity">
              <Form>
                {contracts && contracts.tokensInPool && contracts.tokensInPool.map((tokenKey, index) => (
                  <Form.Group className="mb-3" key={tokenKey}>
                    <Form.Label>
                      {contracts.tokenMapping[tokenKey].symbol} Amount
                    </Form.Label>
                    <Form.Control
                      type="number"
                      value={liquidityAmounts[tokenKey]}
                      onChange={(e) => handleLiquidityAmountChange(tokenKey, e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      readOnly={index !== 0} // 只有第一个代币可以输入
                      className={index !== 0 ? "bg-light" : ""} // 非输入框使用浅色背景
                    />
                  </Form.Group>
                ))}

                <Button
                  variant="primary"
                  onClick={handleAddLiquidity}
                  disabled={!isWalletConnected || !contracts?.tokensInPool?.some(token => liquidityAmounts[token] > 0)}
                >
                  Add Liquidity
                </Button>
              </Form>
            </Tab>

            <Tab eventKey="withdraw" title="Withdraw Liquidity">
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>LP Token Amount to Withdraw</Form.Label>
                  <Form.Control
                    type="number"
                    value={lpTokenAmount}
                    onChange={(e) => setLpTokenAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  onClick={handleWithdrawLiquidity}
                  disabled={!isWalletConnected || !lpTokenAmount || lpTokenAmount <= 0}
                >
                  Withdraw Liquidity
                </Button>
              </Form>
            </Tab>

            <Tab eventKey="rewards" title="LP Rewards">
              <Card className="mb-4">
                <Card.Body>
                  <Card.Title>Your Claimable LP Rewards</Card.Title>
                  
                  <div className="text-end mb-3">
                    <Button 
                      variant="outline-primary" 
                      onClick={handleClaimAllRewards}
                      disabled={!isWalletConnected || 
                        (parseFloat(claimableRewards.token0) <= 0 && 
                         parseFloat(claimableRewards.token1) <= 0 && 
                         parseFloat(claimableRewards.token2) <= 0)}
                    >
                      Claim All Rewards
                    </Button>
                  </div>
                  
                  <Row>
                    <Col md={4}>
                      <Card>
                        <Card.Body>
                          <Card.Title>ALPHA</Card.Title>
                          <Card.Text>Available: {formatNumber(claimableRewards.token0)}</Card.Text>
                          <Form.Group className="mb-3">
                            <Form.Control
                              type="number"
                              value={rewardAmounts.token0}
                              onChange={(e) => setRewardAmounts(prev => ({...prev, token0: e.target.value}))}
                              placeholder="Amount (0 for all)"
                              min="0"
                              max={parseFloat(claimableRewards.token0)}
                              step="0.01"
                            />
                          </Form.Group>
                          <div className="d-flex gap-2">
                            <Button 
                              variant="success" 
                              size="sm"
                              onClick={() => handleClaimRewards(contracts.token0.address, 'token0', rewardAmounts.token0)}
                              disabled={!isWalletConnected || parseFloat(claimableRewards.token0) <= 0}
                            >
                              Claim
                            </Button>
                            <Button 
                              variant="outline-success" 
                              size="sm"
                              onClick={() => handleClaimRewards(contracts.token0.address, 'token0', claimableRewards.token0)}
                              disabled={!isWalletConnected || parseFloat(claimableRewards.token0) <= 0}
                            >
                              Claim All
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card>
                        <Card.Body>
                          <Card.Title>BETA</Card.Title>
                          <Card.Text>Available: {formatNumber(claimableRewards.token1)}</Card.Text>
                          <Form.Group className="mb-3">
                            <Form.Control
                              type="number"
                              value={rewardAmounts.token1}
                              onChange={(e) => setRewardAmounts(prev => ({...prev, token1: e.target.value}))}
                              placeholder="Amount (0 for all)"
                              min="0"
                              max={parseFloat(claimableRewards.token1)}
                              step="0.01"
                            />
                          </Form.Group>
                          <div className="d-flex gap-2">
                            <Button 
                              variant="success" 
                              size="sm"
                              onClick={() => handleClaimRewards(contracts.token1.address, 'token1', rewardAmounts.token1)}
                              disabled={!isWalletConnected || parseFloat(claimableRewards.token1) <= 0}
                            >
                              Claim
                            </Button>
                            <Button 
                              variant="outline-success" 
                              size="sm"
                              onClick={() => handleClaimRewards(contracts.token1.address, 'token1', claimableRewards.token1)}
                              disabled={!isWalletConnected || parseFloat(claimableRewards.token1) <= 0}
                            >
                              Claim All
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={4}>
                      <Card>
                        <Card.Body>
                          <Card.Title>GAMMA</Card.Title>
                          <Card.Text>Available: {formatNumber(claimableRewards.token2)}</Card.Text>
                          <Form.Group className="mb-3">
                            <Form.Control
                              type="number"
                              value={rewardAmounts.token2}
                              onChange={(e) => setRewardAmounts(prev => ({...prev, token2: e.target.value}))}
                              placeholder="Amount (0 for all)"
                              min="0"
                              max={parseFloat(claimableRewards.token2)}
                              step="0.01"
                            />
                          </Form.Group>
                          <div className="d-flex gap-2">
                            <Button 
                              variant="success" 
                              size="sm"
                              onClick={() => handleClaimRewards(contracts.token2.address, 'token2', rewardAmounts.token2)}
                              disabled={!isWalletConnected || parseFloat(claimableRewards.token2) <= 0}
                            >
                              Claim
                            </Button>
                            <Button 
                              variant="outline-success" 
                              size="sm"
                              onClick={() => handleClaimRewards(contracts.token2.address, 'token2', claimableRewards.token2)}
                              disabled={!isWalletConnected || parseFloat(claimableRewards.token2) <= 0}
                            >
                              Claim All
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                  <div className="mt-3 small text-muted">
                    Note: LP rewards are your share of trading fees collected from swaps. Enter amount to claim or leave empty to claim all available rewards.
                  </div>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
}

export default App;