import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

/* User Interface */
import Logo from "./assets/icons/currency-exchange.svg"
import { Card, Tabs, Tab, Row, Col, Form, Button,Container, Badge,Table} from 'react-bootstrap';

/* Interaction with Backend */
import { React, useState, useEffect } from 'react';
import { ethers } from 'ethers';  // Import ethers.js library
import { getAmountOut, getContracts, getPoolInfo, getTokenBalances, getRequiredAmounts, swapTokens, addLiquidity, withdrawingliquidity } from './utils/contract';      // Import helper functions

function App() {
  /* wallet related */
  const [isWalletConnected, setIsWalletConnected] = useState(false); // Track wallet connection
  const [account, setAccount] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [provider, setProvider] = useState(null);
  const [selectedPool, setSelectedPool] = useState('ALPHA-BETA-GAMMA');

  /* balance related */
  const [balances, setBalances] = useState({});
  const [poolInfo, setPoolInfo] = useState({});

  /* swap related */
  // todo: @infinite-zhou 确定一下useState是不是
  const [fromToken, setFromToken] = useState('alpha');
  const [toToken, setToToken] = useState('beta');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  /* add liquidity related */
  const [tokenAmounts, setTokenAmounts] = useState({});

  /* withdraw liquidity related */
  // const [withdrawAmount1, setWithdrawAmount1] = useState('');
  // const [withdrawAmount2, setWithdrawAmount2] = useState('');

  // 所有支持的代币
  const supportedTokens = ['alpha', 'beta', 'gamma'];
  const supportedPools = ['ALPHA-BETA-GAMMA', 'ALPHA-BETA', 'BETA-GAMMA'];

  /*获取poollist*/
  // const PoolList = () => {
  //   return (
  //     <div>
  //       {pools.map((pool) => (
  //         <div key={pool.id} className="pool-card">
  //           <h3>Pool #{pool.id}: {pool.pair}</h3>
  //           <div>
  //             <p><strong>Token0 Balance:</strong> {pool.token0Balance}</p>
  //             <p><strong>Token1 Balance:</strong> {pool.token1Balance}</p>
  //             <p><strong>Total LP Tokens:</strong> {pool.totalLPToken}</p>
  //             <p><strong>Fee:</strong> {pool.fee}</p>
  //           </div>
  //           <div>
  //             <p><strong>Your LP Tokens:</strong> {pool.userLPToken}</p>
  //             <p><strong>Your Total Value:</strong> ${pool.userValue}</p>
  //           </div>
  //         </div>
  //       ))}
  //     </div>
  //   );
  // };

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
        selectedPool,
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

  const handleTokenAmountChange = async (e, tokenName) => {
    const value = e.target.value;
    setTokenAmounts(prev => ({
      ...prev,
      [tokenName]: value
    }));
  };

  const handleConnectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not installed");
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();

      const initializedContracts = await getContracts(signer);

      setProvider(provider);
      setAccount(accounts[0]);
      setContracts(initializedContracts);
      setIsWalletConnected(true);

      // get balance
      const balances = await getTokenBalances(initializedContracts, accounts[0]);
      setBalances(balances);

      // get pool info
      const info = await getPoolInfo(initializedContracts, selectedPool);
      setPoolInfo(info);

      alert(`Wallet connected!`);
    } catch (error) {
      console.error("Detailed connection error:", error);
      alert(`Failed to connect: ${error.message}`);
    }
  };

  const handleSwap = async () => {
    try {
      if (!contracts) return;

      await swapTokens(
        contracts,
        selectedPool,
        fromToken,
        fromAmount,
        toToken
      );

      // update balance
      const balances = await getTokenBalances(contracts, account);
      setBalances(balances);

      // update pool info
      const newPoolInfo = await getPoolInfo(contracts, selectedPool);
      setPoolInfo(newPoolInfo);

      alert('Swap completed successfully!');
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

      const tokenAddresses = [];
      const amounts = [];

      for (const tokenName of supportedTokens) {
        if (tokenAmounts[tokenName]) {
          tokenAddresses.push(contracts.tokens[tokenName].address);
          amounts.push(ethers.parseEther(tokenAmounts[tokenName].toString()));
        }
      }

      await addLiquidity(
        contracts,
        selectedPool,
        tokenAddresses,
        amounts
      );

      // update balance
      const balances = await getTokenBalances(contracts, account);
      setBalances(balances);

      // update pool info
      const newPoolInfo = await getPoolInfo(contracts, selectedPool);
      setPoolInfo(newPoolInfo);

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

      const tokenAddresses = [];
      const amounts = [];

      for (const tokenName of supportedTokens) {
        if (tokenAmounts[tokenName]) {
          tokenAddresses.push(contracts.tokens[tokenName].address);
          amounts.push(ethers.parseEther(tokenAmounts[tokenName].toString()));
        }
      }

      await withdrawingliquidity(
        contracts,
        selectedPool,
        tokenAddresses,
        amounts
      );

      // update balance
      const balances = await getTokenBalances(contracts, account);
      setBalances(balances);

      // update pool info
      const newPoolInfo = await getPoolInfo(contracts, selectedPool);
      setPoolInfo(newPoolInfo);

      alert("Liquidity withdrawn successfully!");
    } catch (error) {
      console.error("Detailed error:", error);
      alert(`Failed to withdraw liquidity: ${error.message}`);
    }
  };

  useEffect(() => {
    const updatePoolInfo = async () => {
      if (contracts && selectedPool) {
        const info = await getPoolInfo(contracts, selectedPool);
        setPoolInfo(info);
      }
    };
    updatePoolInfo();
  }, [contracts, selectedPool]);

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

            {/* 右侧 - 钱包连接按钮 */}
            <Col className="col-auto ms-auto"> 
              {isWalletConnected ? (
                <div className="d-flex align-items-center gap-2">
                  <Badge pill bg="secondary" className="fs-6 py-2">
                    {`${account?.slice(0, 6)}...${account?.slice(-4)}`}
                  </Badge>
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
      
      {/* Pool Selection */}
      <Row className="mb-4">
        <Col>
          <Form.Select
            value={selectedPool}
            onChange={(e) => setSelectedPool(e.target.value)}
            className="mb-3"
          >
            {supportedPools.map(pool => (
              <option key={pool} value={pool}>{pool}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      {/* 个人账户余额 */}
      <Row className="mb-4">
        <Col md={2} className="mb-3">
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="Card-title">Balances</Card.Title>
              {Object.entries(balances).map(([token, balance]) => (
                <Card.Text key={token}>
                  {token.toUpperCase()}：{balance}
                </Card.Text>
              ))}
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
                    <th colSpan="7">Basic Pool Information</th>
                    <th colSpan="2">User Holder</th>
                  </tr>
                  <tr>
                    <th>#</th>
                    <th>Pair</th>
                    {supportedTokens.map(token => (
                      <th key={token}>{token.toUpperCase()} Balance</th>
                    ))}
                    <th>Total LP Tokens</th>
                    <th>Fee</th>
                    <th>User LP Tokens</th>
                    <th>User Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>{selectedPool}</td>
                    {supportedTokens.map(token => (
                      <td key={token}>{poolInfo[token] || '0'}</td>
                    ))}
                    <td>\</td>
                    <td>\</td>
                    <td>\</td>
                    <td>\</td>
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
                      placeholder="0.0"
                      className="me-2"
                    />
                    <Form.Select
                      value={fromToken}
                      onChange={(e) => setFromToken(e.target.value)}
                      style={{ width: '120px' }}
                    >
                      {supportedTokens.map(token => (
                        token !== toToken && (
                          <option key={token} value={token}>{token.toUpperCase()}</option>
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
                      value={toAmount}
                      readOnly
                      placeholder="0.0"
                      className="me-2"
                    />
                    <Form.Select
                      value={toToken}
                      onChange={(e) => setToToken(e.target.value)}
                      style={{ width: '120px' }}
                    >
                      {supportedTokens.map(token => (
                        token !== fromToken && (
                          <option key={token} value={token}>{token.toUpperCase()}</option>
                        )
                      ))}
                    </Form.Select>
                  </div>
                </Form.Group>

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
                {supportedTokens.map(token => (
                  <Form.Group key={token} className="mb-3">
                    <Form.Label>{token.toUpperCase()} Amount</Form.Label>
                    <Form.Control
                      type="number"
                      value={tokenAmounts[token] || ''}
                      onChange={(e) => handleTokenAmountChange(e, token)}
                      placeholder="0.0"
                    />
                  </Form.Group>
                ))}

                <Button
                  variant="primary"
                  onClick={handleAddLiquidity}
                  disabled={!isWalletConnected || !Object.values(tokenAmounts).some(amount => amount > 0)}
                >
                  Add Liquidity
                </Button>
              </Form>
            </Tab>

            <Tab eventKey="withdraw" title="Withdraw Liquidity">
              <Form>
                {supportedTokens.map(token => (
                  <Form.Group key={token} className="mb-3">
                    <Form.Label>{token.toUpperCase()} Amount to Withdraw</Form.Label>
                    <Form.Control
                      type="number"
                      value={tokenAmounts[token] || ''}
                      onChange={(e) => handleTokenAmountChange(e, token)}
                      placeholder="0.0"
                    />
                  </Form.Group>
                ))}

                <Button
                  variant="primary"
                  onClick={handleWithdrawLiquidity}
                  disabled={!isWalletConnected || !Object.values(tokenAmounts).some(amount => amount > 0)}
                >
                  Withdraw Liquidity
                </Button>
              </Form>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
}

export default App;