import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { Card } from 'react-bootstrap';
import { Tabs, Tab } from 'react-bootstrap';
import {Row, Col, Form} from 'react-bootstrap';
import Logo from "./assets/icons/currency-exchange.svg"

function App() {

  return (
    <div className="App">
      <header className="App-header">
        <Card
          border="info"
          bg="dark"
          key="dark"
          text="white"
          style={{ width: "30rem" }}
          className="mb-2"
        >
          <Card.Img src={Logo} style={{ padding: "2rem" }} />
          <Card.ImgOverlay>
            <Card.Title style={{ fontWeight: "bold", fontSize: "4rem", paddingTop: "2rem" }}>
              COMP5521 DeFi APP
            </Card.Title>
            <Tabs
              defaultActiveKey="swap"
              className="mb-3"
              justify
            >
                          <Tab eventKey="swap" title="Swap">
              <Form style={{padding:"1rem"}}>
                From
                <Row style={{padding:"1rem"}}>
                  <Col xs={9}>
                    <Form.Control size="lg"
                                      type="number"
                                      placeholder="0"
                    />
                  </Col>
                  <Col>
                    <Form.Select size="lg">
                      <option value="ALPHA">ALPHA</option>
                      <option value="BETA">BETA</option>
                    </Form.Select>
                  </Col>
                </Row>
                <div style={{padding:'3rem'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor" class="bi bi-arrow-down-circle-fill" viewBox="0 0 16 16">
                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.5 4.5a.5.5 0 0 0-1 0v5.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293z"/>
                  </svg>
                </div>
                To
                <Row style={{padding:"1rem"}}>
                  <Col xs={9}>
                    <Form.Control size="lg"
                                      type="number"
                                      placeholder="0"
                    />
                  </Col>
                  <Col>
                    <Form.Select size="lg">
                      <option value="ALPHA">ALPHA</option>
                      <option value="BETA">BETA</option>
                    </Form.Select>
                  </Col>
                </Row>
              </Form>
            </Tab>
              <Tab eventKey="liquidity" title="Provide Liquidity">

              </Tab>
            </Tabs>
          </Card.ImgOverlay>
        </Card>
      </header>
    </div>
  );
}

export default App;