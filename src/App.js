import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [vtiPrice, setVtiPrice] = useState(295.12); // Default VTI price
  const [particles, setParticles] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // Removed vtiPerformance state

  // Use actual VTI data from CSV file
  const [vtiHistoricalData, setVtiHistoricalData] = useState([]);
  
  // Function to load VTI data from CSV
  const loadVtiData = useCallback(async () => {
    try {
      const response = await fetch('./data/vti-data.csv');
      const csvText = await response.text();
      
      // Parse CSV
      const lines = csvText.split(/\r?\n/);
      const rows = lines.slice(1); // Skip header
      const data = rows
        .map(row => row.trim())
        .filter(row => row !== '')
        .map(row => {
          const parts = row.split(',');
          const dateString = (parts[0] || '').trim();
          const priceString = (parts[1] || '').trim();
          const parsedDate = new Date(dateString);
          const parsedPrice = parseFloat(priceString);
          return {
            date: parsedDate,
            price: parsedPrice
          };
        })
        .filter(item => !isNaN(item.price) && item.date.toString() !== 'Invalid Date')
        .sort((a, b) => a.date - b.date);
      
      setVtiHistoricalData(data);
      setErrorMessage(prev => prev && prev.includes('history') ? '' : prev);
    } catch (error) {
      console.error('Error loading VTI historical data:', error);
      setErrorMessage('Failed to load VTI price history.');
    }
  }, []);

  // Credit card data (removed Ethan)
  const creditCards = [
    { name: 'Jacob', balance: 400, cardNumber: '4532 1234 5678 9012' },
    { name: 'Bella', balance: 100, cardNumber: '4532 2345 6789 0123' },
    { name: 'Melanie', balance: 50, cardNumber: '4532 3456 7890 1234' }
  ];
  
  // Real-time VTI-based conversion rate (USD per 100 ETB)
  const dollarsPer100Etbucks = useMemo(() => vtiPrice / 107.5, [vtiPrice]);

  // Fetch real VTI price from financial API
  const priceFetchControllerRef = useRef(null);
  const fetchVTIPrice = useCallback(async () => {
    // Abort any in-flight request before starting a new one
    if (priceFetchControllerRef.current) {
      priceFetchControllerRef.current.abort();
    }
    const controller = new AbortController();
    priceFetchControllerRef.current = controller;
    setIsLoading(true);
    try {
      // Use Financial Modeling Prep API as primary due to CORS issues with Yahoo Finance and Polygon.io 401
      const apiKey = "45dce6a8aa49cafd332393286f49e99f"; // Access API key from environment variables
      if (!apiKey) {
        console.error('Financial Modeling Prep API key not found in environment variables.');
        setErrorMessage('Missing API key for price fetch.');
        return;
      }
      const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/VTI?apikey=${apiKey}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();

      if (data && data[0] && typeof data[0].price === 'number') {
        setVtiPrice(data[0].price);
        setLastUpdated(new Date());
        setErrorMessage('');
        // eslint-disable-next-line no-console
        console.log(`VTI Price updated (FMP): $${data[0].price}`);
      } else {
        throw new Error('Invalid Financial Modeling Prep response');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // Silently ignore aborted requests
      } else {
        console.error('Error fetching VTI price:', error);
        setErrorMessage('Failed to fetch latest VTI price. Showing last known value.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Particle animation effect (surprise feature!)
  const prefersReducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const createParticle = () => ({
      id: Math.random(),
      x: Math.random() * window.innerWidth,
      y: window.innerHeight + 10,
      speedY: Math.random() * 2 + 1,
      speedX: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 3 + 2,
      opacity: Math.random() * 0.5 + 0.1
    });

    let lastTime = performance.now();
    const maxParticles = 50;
    const frameIntervalMs = 50; // ~20fps
    let rafId = 0;

    const tick = (now) => {
      if (now - lastTime >= frameIntervalMs) {
        lastTime = now;
        setParticles(prev => {
          const updated = prev
            .map(particle => ({
              ...particle,
              y: particle.y - particle.speedY,
              x: particle.x + particle.speedX,
              opacity: particle.opacity * 0.998
            }))
            .filter(particle => particle.y > -10 && particle.opacity > 0.01);

          if (Math.random() < 0.3 && updated.length < maxParticles) {
            updated.push(createParticle());
          }

          return updated.slice(-maxParticles);
        });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [prefersReducedMotion]);

  // Fetch VTI price on component mount and set up periodic updates
  useEffect(() => {
    // Fetch immediately on load
    fetchVTIPrice();
    // Load historical VTI data
    loadVtiData();

    // Update every 30 seconds (to avoid hitting API rate limits)
    const interval = setInterval(fetchVTIPrice, 30000);

    return () => {
      clearInterval(interval);
      if (priceFetchControllerRef.current) {
        priceFetchControllerRef.current.abort();
      }
    };
  }, [fetchVTIPrice, loadVtiData]);

  const formatCardNumber = (number) => {
    return number.replace(/(\d{4})/g, '$1 ').trim();
  };

  const getCardColor = (name) => {
    const colors = {
      'Jacob': '#8B5CF6',
      'Bella': '#EC4899',
      'Melanie': '#10B981'
    };
    return colors[name] || '#6B7280';
  };

  const totalETBucks = creditCards.reduce((sum, card) => sum + card.balance, 0);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const chartData = useMemo(() => ({
    labels: vtiHistoricalData.map(item => item.date.getFullYear()),
    datasets: [
      {
        label: 'ETBucks Value',
        data: vtiHistoricalData.map(item => (item.price / 107.5)), // ETBuck value in dollars
        fill: true,
        borderColor: 'rgb(139, 92, 246)', // Purple
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        tension: 0.4,
        pointRadius: 0, // No points on the line
      },
    ],
  }), [vtiHistoricalData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // No legend needed
      },
      title: {
        display: false, // Title is handled by H3 above
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Value: $${(context.raw).toFixed(2)}`; // Display in dollars with two decimals
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false, // No vertical grid lines
        },
        ticks: {
          color: '#a1a1aa',
        },
      },
      y: {
        min: 1.0, // Minimum ETBuck value to display (in dollars)
        max: 3.0, // Maximum ETBuck value to display (in dollars)
        ticks: {
          callback: function(value) {
            return '$' + value.toFixed(1); // Format as $X.Y
          },
          color: '#a1a1aa',
          stepSize: 0.5 // Adjust step size to 0.5 for 1.0, 1.5, 2.0, 2.5, 3.0
        },
        grid: {
          color: 'rgba(139, 92, 246, 0.1)',
        },
      },
    },
  }), []);

  return (
    <div className="App">
      {/* Animated Background Particles */}
      <div className="particles-container">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="particle"
            style={{
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-text">ETBUCK</span>
            <span className="logo-subtitle">Financial</span>
          </div>
          <nav className="nav">
            <button 
              className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
              aria-pressed={activeTab === 'dashboard'}
              aria-label="Show dashboard"
            >
              <span className="nav-icon">📊</span>
              Dashboard
            </button>
            <button 
              className={`nav-button ${activeTab === 'shop' ? 'active' : ''}`}
              onClick={() => setActiveTab('shop')}
              aria-pressed={activeTab === 'shop'}
              aria-label="Show shop"
            >
              <span className="nav-icon">🛒</span>
              Shop
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <>
            {/* Conversion Rate Section */}
            <section className="conversion-section">
              <div className="conversion-card">
                <div className="conversion-header">
                  <h2 className="conversion-title">ETBUCK Exchange Rate</h2>
                  <div className="live-indicator" aria-live="polite">
                    <span className="pulse-dot"></span>
                    LIVE
                    <button 
                      className="refresh-button" 
                      onClick={fetchVTIPrice}
                      disabled={isLoading}
                      aria-label={isLoading ? 'Refreshing price' : 'Refresh price'}
                    >
                      🔄
                    </button>
                  </div>
                </div>
                <div className="conversion-rate">
                  <span className="rate-amount">100 ETBUCKS = ${dollarsPer100Etbucks.toFixed(4)}</span>
                  <div className="rate-formula">
                    VTI (${vtiPrice.toFixed(2)}) ÷ 107.5
                  </div>
                </div>
                <div className="rate-details">
                  <div className="rate-change positive">↗ Real-time VTI tracking</div>
                  <p className="rate-description">
                    Live rate based on Vanguard Total Stock Market ETF
                    <br />
                    <small>Last updated: {formatTime(lastUpdated)}</small>
                  </p>
                </div>
                {errorMessage && (
                  <div className="error-banner" role="status" aria-live="polite">
                    {errorMessage}
                  </div>
                )}
              </div>
            </section>

            {/* Credit Cards Section */}
            <section className="cards-section">
              <h2 className="section-title">Account Balances</h2>
              <div className="cards-grid">
                {creditCards.map((card, index) => (
                  <div 
                    key={index} 
                    className="credit-card"
                    style={{ '--card-color': getCardColor(card.name) }}
                  >
                    <div className="card-shine"></div>
                    <div className="card-header">
                      <span className="card-type">ETBUCK PREMIUM</span>
                      <div className="card-logo">EB</div>
                    </div>
                    <div className="card-number">
                      {formatCardNumber(card.cardNumber)}
                    </div>
                    <div className="card-info">
                      <div className="card-holder">
                        <span className="label">CARDHOLDER</span>
                        <span className="name">{card.name.toUpperCase()}</span>
                      </div>
                      <div className="card-balance">
                        <span className="label">BALANCE</span>
                        <span className="amount">{card.balance} ETB</span>
                      </div>
                    </div>
                    <div className="card-usd-value">
                      ≈ ${((card.balance * dollarsPer100Etbucks) / 100).toFixed(2)} USD
                    </div>
                    <div className="card-hologram"></div>
                  </div>
                ))}
              </div>
            </section>

            {/* VTI Price Chart */}
            <section className="chart-section">
              <div className="chart-card">
                <h3>Value of 100 ETBucks over time</h3>
                <div className="line-chart-container">
                  {vtiHistoricalData.length > 0 ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div className="loading-chart">Loading VTI price history...</div>
                  )}
                </div>
                <p className="chart-label">VTI price history from 2016 to 2025 - Data source: Weekly closing prices</p>
              </div>
            </section>
          </>
        )}

        {activeTab === 'shop' && (
          <section className="shop-section">
            <div className="shop-content">
              <div className="shop-header">
                <div className="shop-icon">🎯</div>
                <h2>ETBUCK Marketplace</h2>
                <p>Discover exclusive items and experiences available for ETBucks!</p>
              </div>
              <div className="shop-items-grid">
                {[
                  { name: 'Tootsie Roll', price: 10 },
                  { name: '10m Turn on VR', price: 20 },
                  { name: '20 min screens', price: 30 },
                  { name: 'Mini Pie', price: 40 },
                  { name: 'Ice Cream Cone', price: 60 },
                  { name: 'Small Fry', price: 100 },
                  { name: '2 Root Beer Floats', price: 100 },
                  { name: 'Movie night', price: 150 },
                ].map((item, index) => (
                  <div key={index} className="shop-item">
                    <span className="item-name">{item.name}</span>
                    <span className="item-price">{item.price} ETB</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

