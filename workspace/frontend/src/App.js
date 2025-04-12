import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

/* User Interface */
import Logo from "./assets/icons/currency-exchange.svg"
import { Card, Tabs, Tab, Row, Col, Form, Button, Container, Badge, Table, Dropdown } from 'react-bootstrap';

/* Interaction with Backend */
import { React, useState, useEffect } from 'react';
import { ethers } from 'ethers';  // Import ethers.js library
import { getAmountOut, getContracts, getPoolInfo, getTokenBalances, getRequiredAmounts, swapTokens, addLiquidity, withdrawLiquidity, getLPTokenInfo, getAvailablePools, getPoolFees, getClaimableRewards, claimLpIncentives } from './utils/contract';      // Import helper functions

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

  const handleLiquidityAmountChange = (tokenKey, value) => {

    // const value = value;
    setToken0Amount(value);

    if (value && !isNaN(value)) {
      const [token1Amount, token2Amount] = calculateTokenAmounts(value);
      setToken1Amount(token1Amount);
      setToken2Amount(token2Amount);
    } else {
      setToken1Amount('');
      setToken2Amount('');
    }
    setLiquidityAmounts({
      ...liquidityAmounts,
      [tokenKey]: value
    });
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
      if (!contracts) return;

      const tokenIn = fromToken;
      const tokenOut = toToken;

      // 计算手续费
      const fee = parseFloat(fromAmount) * 0.003;
      console.log(tokenIn,fromAmount,tokenOut,fee)
      console.log(fromToken,toToken)
      await swapTokens(contracts, tokenIn, fromAmount, tokenOut);

      // 更新所有信息
      await updatePoolAndBalances();

      // Reset input fields
      setFromAmount('');
      setToAmount('');
      // 显示包含手续费的成功消息
      alert(`Swap completed successfully!\nAmount: ${fromAmount} ${fromToken}\nFee: ${fee.toFixed(6)} ${fromToken} (0.3%)`);
    } catch (error) {
      console.error(error);
      alert('Failed to swap tokens');
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

                {/* 添加手续费显示 */}
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