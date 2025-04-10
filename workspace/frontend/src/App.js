import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

/* User Interface */
import Logo from "./assets/icons/currency-exchange.svg"
import {Card, Tabs, Tab, Row, Col, Form, Button} from 'react-bootstrap';

/* Interaction with Backend */
import { React, useState, useEffect } from 'react';
import { ethers } from 'ethers';  // Import ethers.js library
import { getAmountOut,getContracts, getPoolInfo, getTokenBalances, getRequiredAmount1, swapTokens, addLiquidity, withdrawingliquidity } from './utils/contract';      // Import helper functions

function App() {
  /* wallet related */
  const [isWalletConnected, setIsWalletConnected] = useState(false); // Track wallet connection
  const [account, setAccount] = useState(null);
<<<<<<< Updated upstream
	const [contracts, setContracts] = useState(null);
	const [provider, setProvider] = useState(null);

  /* balance related */
  const [balance0, setBalance0] = useState(0);
  const [balance1, setBalance1] = useState(0);
  const [poolInfo, setPoolInfo] = useState({ token0Balance: '0', token1Balance: '0' });

  /* swap related */
  const [fromToken, setFromToken] = useState('ALPHA');
  const [toToken, setToToken] = useState('BETA');
=======
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
>>>>>>> Stashed changes
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');

  /* add liquidity related */
<<<<<<< Updated upstream
  const [token0Amount, setToken0Amount] = useState('');
  const [token1Amount, setToken1Amount] = useState('');
  
  /* withdraw liquidity related */
  // const [withdrawAmount1, setWithdrawAmount1] = useState('');
  // const [withdrawAmount2, setWithdrawAmount2] = useState('');
  
=======
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

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        const mappedTokenIn = tokenIn === 'ALPHA' ? 'token0' : 'token1';
        const mappedTokenOut = tokenOut === 'ALPHA' ? 'token0' : 'token1';

        const result = await getAmountOut(
            contracts,
            mappedTokenIn,
            inputAmount,
            mappedTokenOut
        );
        return result;
=======
      const result = await getAmountOut(
        contracts,
        selectedPool,
        tokenIn,
        inputAmount,
        tokenOut
      );
      return result;
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    setToken0Amount(value);
    
    if (value && !isNaN(value)) {
        const token1Amount = await calculateToken1Amount(value);
        setToken1Amount(token1Amount);
    } else {
        setToken1Amount('');
    }
  };

  const calculateToken1Amount = async (amount0) => {
      if (!amount0 || !contracts || isNaN(amount0) || amount0 <= 0) {
          return '0';
      }

      try {
          const result = await getRequiredAmount1(contracts, amount0);
          return result;
      } catch (error) {
          console.error("Error calculating token1 amount:", error);
          return '0';
      }
=======
    setTokenAmounts(prev => ({
      ...prev,
      [tokenName]: value
    }));
>>>>>>> Stashed changes
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
        setBalance0(balances.token0);
        setBalance1(balances.token1);

        // get pool info
        const info = await getPoolInfo(initializedContracts);
        setPoolInfo(info);

        alert(`Wallet connected!`);
      } catch (error) {
          console.error("Detailed connection error:", error);
          alert(`Failed to connect: ${error.message}`);
      }
<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes
  };

  const handleSwap = async () => {
    try {
        if (!contracts) return;

<<<<<<< Updated upstream
        const tokenIn = fromToken === 'ALPHA' ? 'token0' : 'token1';
        const tokenOut = toToken === 'ALPHA' ? 'token0' : 'token1';

        await swapTokens(contracts, tokenIn, fromAmount, tokenOut);

        // update balance
        const balances = await getTokenBalances(contracts, account);
        setBalance0(balances.token0);
        setBalance1(balances.token1);

        // update pool info
        const newPoolInfo = await getPoolInfo(contracts);
        setPoolInfo(newPoolInfo);
=======
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
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
        await addLiquidity(contracts, token0Amount);

        // update balance
        const balances = await getTokenBalances(contracts, account);
        setBalance0(balances.token0);
        setBalance1(balances.token1);

        // update pool info
        const newPoolInfo = await getPoolInfo(contracts);
        setPoolInfo(newPoolInfo);

        alert("Liquidity added successfully!");
=======
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
>>>>>>> Stashed changes
    } catch (error) {
        console.error("Detailed error:", error);
        alert(`Failed to add liquidity: ${error.message}`);
    }
  };

  // todo: infinite zhou: 确认
  const handleWithdrawLiquidity = async () => {
    try {
        if (!contracts || !account) {
            throw new Error("Contracts or account not initialized");
        }
        
        // @todo: infinite zhou: 
        await withdrawingliquidity(contracts, token0Amount);

<<<<<<< Updated upstream

        alert("Liquidity withdrawn successfully!");
=======
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
>>>>>>> Stashed changes
    } catch (error) {
        console.error("Error withdrawing liquidity:", error);
        alert(`Failed to withdraw liquidity: ${error.message}`);
    }
  };
<<<<<<< Updated upstream
  
=======

  useEffect(() => {
    const updatePoolInfo = async () => {
      if (contracts && selectedPool) {
        const info = await getPoolInfo(contracts, selectedPool);
        setPoolInfo(info);
      }
    };
    updatePoolInfo();
  }, [contracts, selectedPool]);

>>>>>>> Stashed changes
  return (
    <div className="App">
      <header className="App-header">
      <Card
        border="info"
        bg="dark"
        key="dark"
        text="white"
        style={{ width: "50rem"}}
        className="mb-2"
      >
      <Card.Body>
        <Card.Title>Liquidity Pool Balances</Card.Title>
        <Row>
        <Card.Text as={Col} >
          {poolInfo.token0Balance} ALPHA
        </Card.Text>
        <Card.Text as={Col}>
          {poolInfo.token1Balance} BETA
        </Card.Text>
        </Row>
      </Card.Body>
    </Card>

<<<<<<< Updated upstream
      <Card
        border="info"
        bg="dark"
        key="dark"
        text="white"
        style={{ width: "50rem", marginTop: "3rem" }}
        className="mb-2"
      >
        <Card.Img src={Logo} style={{padding:"2rem"}}/>
        <Card.ImgOverlay>
          <Card.Title style={{fontWeight:"bold", fontSize:"4rem",paddingTop:"2rem"}}>
            COMP5521 DeFi Swap
          </Card.Title>
          <Tabs
            defaultActiveKey="swap"
            className="mb-3"
            justify
          >
=======
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
>>>>>>> Stashed changes
            <Tab eventKey="swap" title="Swap">
              <Form style={{padding:"1rem"}}>
              From
              <Row style={{padding:"1rem"}}>
                  <Col xs={9}>
                      <Form.Control 
                          size="lg"
                          type="number"
                          placeholder="0"
                          value={fromAmount}
                          min="0"
                          onChange={handleFromAmountChange}
                      />
                  </Col>
                  <Col>
                      <Form.Select
                          size="lg"
                          value={fromToken}
                          onChange={(e) => {
                              setFromToken(e.target.value);
                              if (e.target.value === toToken) {
                                  setToToken(fromToken);
                              }
                              setFromAmount('');
                              setToAmount('');
                          }}
                      >
                          <option value="ALPHA">ALPHA</option>
                          <option value="BETA">BETA</option>
                      </Form.Select>
                  </Col>
              </Row>
              <div style={{padding:'3rem', cursor: 'pointer'}} onClick={handleTokenSwitch}>
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="currentColor" class="bi bi-arrow-down-up" viewBox="0 0 16 16">
                  <path fill-rule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5m-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5"/>
                </svg>
              </div>
                To
                <Row style={{padding:"1rem"}}>
                  <Col xs={9}>
                    <Form.Control size="lg"
                                      type="number"
                                      placeholder="0"
                                      value={toAmount}
                                      disabled
                    />
                  </Col>
                  <Col>
                  <Form.Select
                    size="lg"
                    value={toToken}
                    onChange={(e) => {
                        setToToken(e.target.value);
                        if (e.target.value === fromToken) {
                            setFromToken(toToken);
                        }
                        setFromAmount('');
                        setToAmount('');
                    }}
                    >
<<<<<<< Updated upstream
                      <option value="ALPHA">ALPHA</option>
                      <option value="BETA">BETA</option>
=======
                      {supportedTokens.map(token => (
                        token !== toToken && (
                          <option key={token} value={token}>{token.toUpperCase()}</option>
                        )
                      ))}
>>>>>>> Stashed changes
                    </Form.Select>
                  </Col>
                </Row>
              </Form>
                {!isWalletConnected ? (
                  <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleConnectWallet} block>
                    Connect Wallet
                  </Button>
<<<<<<< Updated upstream
                ) : (
                  <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleSwap} block>
                    Swap
                  </Button>
                )}
            </Tab>
            <Tab eventKey="liquidity" title="Provide Liquidity">
              <Form style={{padding:"1rem"}}>
                  <div>First Token</div>
                  <Row style={{padding:"1rem"}}>
                      <Col xs={9}>
                          <Form.Control 
                              size="lg"
                              type="number"
                              placeholder="0"
                              value={token0Amount}
                              onChange={handleToken0AmountChange}
                              min="0"
                          />
                      </Col>
                      <Col>
                          <Form.Select size="lg" disabled>
                              <option value="ALPHA">ALPHA</option>
                          </Form.Select>
                      </Col>
                  </Row>
                  <div style={{padding:'1rem', textAlign: 'center'}}>
                      <span>+</span>
=======
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
>>>>>>> Stashed changes
                  </div>
                  <div>Second Token</div>
                  <Row style={{padding:"1rem"}}>
                      <Col xs={9}>
                          <Form.Control 
                              size="lg"
                              type="number"
                              placeholder="0"
                              value={token1Amount}
                              disabled
                          />
                      </Col>
                      <Col>
                          <Form.Select size="lg" disabled>
                              <option value="BETA">BETA</option>
                          </Form.Select>
                      </Col>
                  </Row>
                  {!isWalletConnected ? (
                      <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleConnectWallet}>
                          Connect Wallet
                      </Button>
                  ) : (
                      <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleAddLiquidity}>
                          Add Liquidity
                      </Button>
                  )}
              </Form>
            </Tab>
<<<<<<< Updated upstream
            <Tab eventKey="withdraw" title="Withdraw Liquidity">
                <Form style={{padding:"1rem"}}>
                    <div>First Token</div>
                    <Row style={{padding:"1rem"}}>
                        <Col xs={9}>
                            <Form.Control 
                                size="lg"
                                type="number"
                                placeholder="0"
                                value={token0Amount}
                                onChange={handleToken0AmountChange}
                                min="0"
                            />
                        </Col>
                        <Col>
                            <Form.Select size="lg" disabled>
                                <option value="ALPHA">ALPHA</option>
                                <option value="BETA">BETA</option>
                            </Form.Select>
                        </Col>
                    </Row>
                    <div style={{padding:'1rem', textAlign: 'center'}}>
                      <span>+</span>
                  </div>
                  <div>Second Token</div>
                  <Row style={{padding:"1rem"}}>
                      <Col xs={9}>
                          <Form.Control size="lg" type="number" placeholder="0" value={token1Amount} disabled />
                      </Col>
                      <Col>
                          <Form.Select size="lg" disabled>
                              <option value="BETA">BETA</option>
                          </Form.Select>
                      </Col>
                  </Row>
                </Form>
                {!isWalletConnected ? (
                      <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleConnectWallet}>
                          Connect Wallet
                      </Button>
                  ) : (
                      <Button variant="outline-info" size="lg" style={{margin:"1rem"}} onClick={handleWithdrawLiquidity}>
                          Withdraw Liquidity
                      </Button>
                  )}
=======

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
>>>>>>> Stashed changes
            </Tab>
          </Tabs>
        </Card.ImgOverlay>
	    </Card>
      {isWalletConnected && (
        <Card
            border="info"
            bg="dark"
            key="dark"
            text="white"
            style={{ width: "50rem", marginTop: "3rem"}}
            className="mb-2"
        >
          <Card.Body>
            <Card.Title> Your Wallet Balances</Card.Title>
            <Row>
            <Card.Text as={Col} >
              {balance0} ALPHA
            </Card.Text>
            <Card.Text as={Col}>
              {balance1} BETA
            </Card.Text>
            </Row>
          </Card.Body>
        </Card>
        )}
      </header>
    </div>
  );
}

export default App;