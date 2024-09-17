// MineContent.tsx

import React, { useEffect, useState, useRef } from 'react';
import { upgradeLevels } from './upgrades';
import UpgradeNotification from './UpgradeNotification';
import './minecontent.css';

interface MineContentProps {
  points: number;
  setPoints: (points: number | ((prevPoints: number) => number)) => void;
  username: string | null;
  userId: number | null;
  tapProfitLevel: number;
  tapIncreaseLevel: number;
  remainingClicks: number;
  upgrades: { [key: string]: number };
  setUpgrades: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
  farmLevel: number;
  setFarmLevel: React.Dispatch<React.SetStateAction<number>>;
  incomePerHour: number;
  setIncomePerHour: React.Dispatch<React.SetStateAction<number>>;
  entryTime: string | null;
  exitTime: string | null;
  setEntryTime: React.Dispatch<React.SetStateAction<string | null>>;
  setExitTime: React.Dispatch<React.SetStateAction<string | null>>;
}

const MineContent: React.FC<MineContentProps> = ({
  points,
  setPoints,
  username,
  userId,
  tapProfitLevel,
  tapIncreaseLevel,
  remainingClicks,
  upgrades,
  setUpgrades,
  farmLevel,
  incomePerHour,
  setIncomePerHour,
  entryTime,
  exitTime,
  setEntryTime,
  setExitTime,
}) => {
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [isUpgradesMenuOpen, setIsUpgradesMenuOpen] = useState(false);
  const [selectedMineUpgrade, setSelectedMineUpgrade] = useState<string | null>(null);

  const [collectedCoins, setCollectedCoins] = useState<number>(0);
  const [collectionTimer, setCollectionTimer] = useState<number>(3 * 60 * 60); // 3 hours in seconds
  const timerIntervalRef = useRef<number | null>(null);

  const farmLevelMultipliers = [1, 1.2, 1.4, 1.6, 1.8, 2.0];

  const calculateTotalIncome = (upgrades: { [key: string]: number }, farmLevel: number): number => {
    let income = 0;
    for (const [key, level] of Object.entries(upgrades)) {
      const upgradeLevel = upgradeLevels[key as keyof typeof upgradeLevels][level - 1];
      if ('profit' in upgradeLevel) {
        income += upgradeLevel.profit;
      }
    }
    return income * farmLevelMultipliers[farmLevel - 1];
  };

  useEffect(() => {
    const totalIncome = calculateTotalIncome(upgrades, farmLevel);
    setIncomePerHour(totalIncome);
  }, [upgrades, farmLevel, setIncomePerHour]);

  // Accumulate coins in collectedCoins
  useEffect(() => {
    let startTime = Date.now();

    // If there's time left in the collection timer
    if (collectionTimer > 0) {
      timerIntervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const elapsedTime = (now - startTime) / 1000; // in seconds
        const incomePerSecond = incomePerHour / 3600;
        const potentialCollected = incomePerSecond * elapsedTime;

        setCollectedCoins((prev) => {
          const newTotal = prev + potentialCollected;
          const maxCollectible = incomePerHour * 3; // Max collection for 3 hours
          return Math.min(newTotal, maxCollectible);
        });

        setCollectionTimer((prev) => Math.max(prev - elapsedTime, 0));

        startTime = now;

        // Stop accumulation when timer reaches zero
        if (collectionTimer - elapsedTime <= 0) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
        }
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [incomePerHour, collectionTimer]);

  // Update collectedCoins and collectionTimer on entry
  useEffect(() => {
    const fetchEntryExitTime = async () => {
      if (userId) {
        try {
          const response = await fetch(`/get-entry-exit-time?userId=${userId}`);
          const data = await response.json();
          if (data.entryTime && data.exitTime) {
            // Update entryTime and exitTime states
            setEntryTime(data.entryTime);
            setExitTime(data.exitTime);

            const lastExitTime = new Date(data.exitTime).getTime();
            const now = Date.now();
            const elapsedTime = (now - lastExitTime) / 1000; // in seconds

            // Update collectedCoins
            const incomePerSecond = incomePerHour / 3600;
            const potentialCollected = incomePerSecond * elapsedTime;
            const maxCollectible = incomePerHour * 3; // Max collection for 3 hours
            const newCollectedCoins = Math.min(potentialCollected, maxCollectible);
            setCollectedCoins(newCollectedCoins);

            // Update collectionTimer
            const newTimerValue = Math.max(3 * 60 * 60 - elapsedTime, 0);
            setCollectionTimer(newTimerValue);
          }
        } catch (error) {
          console.error('Error fetching entry/exit time:', error);
        }
      }
    };

    fetchEntryExitTime();

    // Save current time as entryTime
    const now = new Date().toISOString();
    setEntryTime(now);

    // Send to server
    fetch('/save-entry-exit-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'enter', time: now }),
    });
  }, [userId, incomePerHour, setEntryTime, setExitTime]);

  // Save exitTime when component unmounts
  useEffect(() => {
    return () => {
      const now = new Date().toISOString();
      setExitTime(now);
      // Send to server
      fetch('/save-entry-exit-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'exit', time: now }),
      });
    };
  }, [userId, setExitTime]);

  const handleCollect = () => {
    const coinsToAdd = Math.floor(collectedCoins);
    // Add collected coins to points
    setPoints((prevPoints) => prevPoints + coinsToAdd);
    setCollectedCoins(0);
    setCollectionTimer(3 * 60 * 60); // Reset timer to 3 hours

    // Save updated points on server
    if (userId !== null) {
      fetch('/update-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          points: points + coinsToAdd,
        }),
      }).catch((error) => {
        console.error('Error updating points:', error);
      });
    }
  };

  const handleUpgradeClick = (upgrade: string) => {
    setSelectedMineUpgrade(upgrade);
    // Keep the upgrades menu open
  };

  const closeUpgradeMenu = () => {
    setSelectedMineUpgrade(null);
  };

  const closeUpgradesMenu = () => {
    setIsUpgradesMenuOpen(false);
  };

  const handleUpgrade = () => {
    if (selectedMineUpgrade) {
      const currentLevel = upgrades[selectedMineUpgrade] || 1;

      if (currentLevel < 10) {
        const nextLevel = currentLevel + 1;
        const upgradeData =
          upgradeLevels[selectedMineUpgrade as keyof typeof upgradeLevels][nextLevel - 1];

        if (points >= upgradeData.cost) {
          const newPoints = points - upgradeData.cost;
          setPoints(newPoints);

          const newUpgrades = {
            ...upgrades,
            [selectedMineUpgrade]: nextLevel,
          };
          setUpgrades(newUpgrades);
          setNotificationMessage(`Upgraded ${selectedMineUpgrade} to level ${nextLevel}`);

          // Update incomePerHour
          const totalIncome = calculateTotalIncome(newUpgrades, farmLevel);
          setIncomePerHour(totalIncome);

          // Save data on the server
          fetch('/save-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              points: newPoints,
              tapProfitLevel,
              tapIncreaseLevel,
              remainingClicks,
              ...newUpgrades,
              farmLevel,
              incomePerHour: totalIncome,
            }),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              if (data.success) {
                console.log('Data saved successfully.');
              } else {
                console.error('Server error: data was not saved');
              }
            })
            .catch((error) => {
              console.error('Error saving data:', error);
              alert('Error saving data. Please try again.');
            });
        } else {
          alert('Not enough coins for upgrade');
        }
      }
    }
  };

  // List of upgrades
  const upgradesList = [
    'upgrade1',
    'upgrade2',
    'upgrade3',
    'upgrade4',
    'upgrade5',
    'upgrade6',
    'upgrade7',
    'upgrade8',
  ];

  // Format time for timer display
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <>
      {notificationMessage && <UpgradeNotification message={notificationMessage} />}
      <div className="px-4 z-10 pt-4">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-gray-800"></div>
          <div>
            <p className="text-sm text-gray-300">{username ? username : 'Guest'}</p>
          </div>
        </div>
      </div>
      {/* Coins and hourly income block */}
      <div className="px-4 mt-4">
        <div className="h-[50px] bg-gray-700 rounded-lg flex">
          <div className="flex-1 flex items-center justify-center border-r border-gray-600">
            <span className="text-sm text-gray-300">
              Coins: {Math.floor(points).toLocaleString()}
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-400">Income</span>
            <span className="text-sm text-gray-300">{incomePerHour.toFixed(2)} / hour</span>
          </div>
        </div>
      </div>
      {/* Display entryTime and exitTime */}
      <div className="px-4 mt-2">
        <p className="text-sm text-gray-400">
          Last Entry: {entryTime ? new Date(entryTime).toLocaleString() : 'Unknown'}
        </p>
        <p className="text-sm text-gray-400">
          Last Exit: {exitTime ? new Date(exitTime).toLocaleString() : 'Unknown'}
        </p>
      </div>
      {/* "Upgrades" button */}
      <div className="px-4 mt-4">
        <button
          className="w-full h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg shadow-lg overflow-hidden relative flex items-center justify-between px-4"
          onClick={() => setIsUpgradesMenuOpen(true)}
        >
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-white bg-opacity-20 rounded-full">
              {/* Upgrades icon */}
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Upgrades</span>
          </div>
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5" />
          </svg>
        </button>
      </div>

      {isUpgradesMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
          onClick={closeUpgradesMenu}
        >
          <div
            className="bg-gray-900 w-full max-w-md p-6 rounded-t-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90%' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-white">Upgrades</h2>
              <button className="text-gray-400" onClick={closeUpgradesMenu}>
                ✕
              </button>
            </div>
            {/* Upgrades list with scrolling */}
            <div className="grid grid-cols-2 gap-4 overflow-y-auto" style={{ maxHeight: '75vh' }}>
              {upgradesList.map((upgrade, index) => (
                <button
                  key={index}
                  className="w-full h-[120px] bg-gray-800 rounded-lg flex flex-col items-center justify-center"
                  onClick={() => handleUpgradeClick(upgrade)}
                >
                  {/* Add images or icons for each upgrade */}
                  <div className="mb-2">
                    <img src={`/images/${upgrade}.png`} alt={upgrade} className="w-12 h-12" />
                  </div>
                  <span className="text-sm text-white">{`Upgrade ${index + 1}`}</span>
                  <span className="text-xs text-gray-300">Level {upgrades[upgrade] || 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedMineUpgrade && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeUpgradeMenu}
        >
          <div
            className="bg-gray-900 w-11/12 max-w-md p-6 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-center text-xl text-white mb-2">{`Upgrade ${selectedMineUpgrade}`}</h2>
            <p className="text-center text-gray-300 mb-4">
              Level: {upgrades[selectedMineUpgrade] || 1}
            </p>
            <p className="text-center text-gray-400 mb-4">
              {/* You can add individual descriptions for each upgrade here */}
              Upgrade description. This upgrade will help you increase production and earn more coins.
            </p>
            {upgrades[selectedMineUpgrade] === 10 ? (
              <p className="text-center text-yellow-400 mb-4">Maximum level reached</p>
            ) : (
              <>
                <button
                  className="w-full py-3 bg-yellow-500 text-black rounded-lg"
                  onClick={handleUpgrade}
                >
                  Upgrade (
                  {
                    upgradeLevels[selectedMineUpgrade as keyof typeof upgradeLevels][
                      upgrades[selectedMineUpgrade]
                    ].cost
                  }{' '}
                  coins)
                </button>
              </>
            )}
            <button
              className="w-full py-2 mt-2 bg-gray-700 text-white rounded-lg"
              onClick={closeUpgradeMenu}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* New block with collected coins, timer, and "Collect" button */}
      <div className="fixed bottom-16 w-full px-4">
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center">
          <span className="text-lg text-white">
            Collected Coins: {Math.floor(collectedCoins).toLocaleString()}
          </span>
          <span className="text-sm text-gray-300">Timer: {formatTime(collectionTimer)}</span>
          <button
            className="mt-2 w-full py-2 bg-green-500 text-white rounded-lg"
            onClick={handleCollect}
          >
            Collect
          </button>
        </div>
      </div>
    </>
  );
};

export default MineContent;
