import React, { useState, useEffect } from 'react';
import { upgradeLevels } from './upgrades';
import UpgradeNotification from './UpgradeNotification';
import './minecontent.css';

interface MineContentProps {
  points: number;
  setPoints: (points: number | ((prevPoints: number) => number)) => void;
  selectedUpgrade: string | null;
  setSelectedUpgrade: (upgrade: string | null) => void;
  username: string | null;
  userId: number | null;
}

const farmLevelMultipliers = [1, 1.2, 1.2, 1.2, 1.2, 1.2];

const MineContent: React.FC<MineContentProps> = ({ points, setPoints, username, userId }) => {
  const [isUpgradeMenuOpen, setIsUpgradeMenuOpen] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);
  const [upgrades, setUpgrades] = useState<{ [key: string]: number }>({
    upgrade1: 1, upgrade2: 1, upgrade3: 1, upgrade4: 1,
    upgrade5: 1, upgrade6: 1, upgrade7: 1, upgrade8: 1
  });
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [farmLevel, setFarmLevel] = useState<number>(1);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [earnedCoins, setEarnedCoins] = useState<number>(0); // Заработанные монеты
  const [isUpgradeView, setIsUpgradeView] = useState(false); // Переход на новую вкладку улучшений

  useEffect(() => {
    if (userId !== null) {
      fetch(`/app?userId=${userId}`)
        .then((response) => response.json())
        .then((data) => {
          setUpgrades({
            upgrade1: data.upgrade1 || 1,
            upgrade2: data.upgrade2 || 1,
            upgrade3: data.upgrade3 || 1,
            upgrade4: data.upgrade4 || 1,
            upgrade5: data.upgrade5 || 1,
            upgrade6: data.upgrade6 || 1,
            upgrade7: data.upgrade7 || 1,
            upgrade8: data.upgrade8 || 1
          });
          setFarmLevel(data.farmLevel || 1);
          setTotalIncome(calculateTotalIncome({
            upgrade1: data.upgrade1 || 1,
            upgrade2: data.upgrade2 || 1,
            upgrade3: data.upgrade3 || 1,
            upgrade4: data.upgrade4 || 1,
            upgrade5: data.upgrade5 || 1,
            upgrade6: data.upgrade6 || 1,
            upgrade7: data.upgrade7 || 1,
            upgrade8: data.upgrade8 || 1
          }, data.farmLevel || 1));
        })
        .catch((error) => console.error('Ошибка загрузки данных:', error));
    }
  }, [userId]);

  const calculateTotalIncome = (upgrades: { [key: string]: number }, farmLevel: number): number => {
    let income = 0;
    for (const [key, level] of Object.entries(upgrades)) {
      const upgradeLevel = upgradeLevels[key as keyof typeof upgradeLevels][level - 1];
      if ('profit' in upgradeLevel) {
        income += upgradeLevel.profit;
      }
    }
    return income * farmLevelMultipliers[farmLevel];
  };

  useEffect(() => {
    const incomePerSecond = totalIncome / 3600;
    if (totalIncome > 0) {
      const interval = setInterval(() => {
        setPoints((prevPoints: number) => prevPoints + incomePerSecond);
        setEarnedCoins((prevCoins) => prevCoins + incomePerSecond); // Обновляем заработанные монеты
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [totalIncome, setPoints]);

  useEffect(() => {
    if (userId !== null) {
      const saveIncomeToDatabase = async (income: number) => {
        try {
          await fetch('/save-income', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, incomePerHour: income }),
          });
        } catch (error) {
          console.error('Ошибка сохранения дохода:', error);
        }
      };

      saveIncomeToDatabase(totalIncome);
    }
  }, [totalIncome, userId]);

  const handleUpgradeClick = (upgrade: string) => {
    setSelectedUpgrade(upgrade);
    setIsUpgradeMenuOpen(true);
  };

  const closeUpgradeMenu = () => {
    setIsUpgradeMenuOpen(false);
    setSelectedUpgrade(null);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeUpgradeMenu();
    }
  };

  const handleUpgrade = () => {
    if (selectedUpgrade) {
      const currentLevel = upgrades[selectedUpgrade] || 1;
      if (currentLevel < 10) {
        const nextLevel = currentLevel + 1;
        const upgradeData = upgradeLevels[selectedUpgrade as keyof typeof upgradeLevels][nextLevel - 1];

        if (points >= upgradeData.cost) {
          setUpgrades((prevUpgrades) => ({
            ...prevUpgrades,
            [selectedUpgrade]: nextLevel,
          }));

          if ('profit' in upgradeData) {
            setTotalIncome(totalIncome + upgradeData.profit);
          }

          setPoints(points - upgradeData.cost);
          setNotificationMessage(`Upgraded ${selectedUpgrade} to level ${nextLevel}`);
          closeUpgradeMenu();

          // Сохранение данных на сервере
          fetch('/save-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              points: points - upgradeData.cost,
              ...upgrades,
              farmLevel: farmLevel || 1,
            }),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              if (data.success) {
                console.log('Улучшение успешно сохранено.');
              } else {
                console.error('Ошибка на сервере: данные не были сохранены');
              }
            })
            .catch((error) => {
              console.error('Ошибка сохранения улучшения:', error);
              alert('Ошибка сохранения данных. Попробуйте снова.');
            });
        } else {
          alert('Not enough points to upgrade');
        }
      }
    }
  };

  const handleUpgradeViewToggle = () => {
    setIsUpgradeView(!isUpgradeView);
  };

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

  useEffect(() => {
    const enterTime = new Date().toISOString();

    if (userId !== null) {
      fetch('/save-entry-exit-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, enterTime }),
      }).catch(err => console.error('Ошибка записи времени входа:', err));
    }

    return () => {
      const exitTime = new Date().toISOString();
      if (userId !== null) {
        fetch('/save-entry-exit-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, exitTime }),
        }).catch(err => console.error('Ошибка записи времени выхода:', err));
      }
    };
  }, [userId]);

  return (
    <>
      {notificationMessage && <UpgradeNotification message={notificationMessage} />}

      <div className="px-4 z-10 pt-4">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-gray-800"></div>
          <div>
            <p className="text-sm text-gray-300">{username ? username : 'Гость'}</p>
          </div>
        </div>
      </div>

      {!isUpgradeView ? (
        <>
          <div className="px-4 mt-4">
            <button
              className="w-full h-20 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg shadow-lg overflow-hidden relative"
              onClick={handleUpgradeViewToggle}
            >
              <div className="absolute top-0 left-0 w-full h-full bg-yellow-400 opacity-10"></div>
              <div className="flex justify-between items-start p-3">
                <span className="text-lg font-semibold text-gray-300">Upgrade Options</span>
                <span className="text-xs font-medium text-yellow-400 bg-gray-800 px-2 py-1 rounded-full">Open</span>
              </div>
            </button>
          </div>

          <div className="mt-5 px-4 bg-gray-700 p-4 rounded-lg">
            <div className="text-center text-yellow-400 text-xl">Заработанные монеты: {earnedCoins.toFixed(2)}</div>
            <button className="w-full py-3 bg-yellow-500 text-black rounded-lg mt-2">
              Забрать монеты
            </button>
            <div className="text-center text-gray-400 mt-2">Таймер: 3 часа</div>
          </div>
        </>
      ) : (
        <div>
          <button onClick={handleUpgradeViewToggle} className="text-white mb-4">
            Back
          </button>

          <div className="mt-5 px-4 grid grid-cols-2 gap-2.5">
            <div>Upgrade 1: {upgrades.upgrade1}</div>
            <div>Farm Level: {farmLevel}</div>
            {/* Остальные улучшения */}
          </div>
        </div>
      )}

      <div className="mt-5 px-4 grid grid-cols-2 gap-2.5 scrollable-upgrades">
        {upgradesList.map((upgrade, index) => (
          <button
            key={index}
            className="w-[100%] h-[100px] bg-gray-700 rounded-lg flex flex-col items-center justify-center"
            onClick={() => handleUpgradeClick(upgrade)}
          >
            <span className="text-sm text-white">{upgrade}</span>
            <span className="text-xs text-gray-300">Level {upgrades[upgrade] || 1}</span>
          </button>
        ))}
      </div>

      {isUpgradeMenuOpen && selectedUpgrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50" onClick={handleOverlayClick}>
          <div className="bg-gray-800 w-full max-w-md p-9 rounded-t-lg animate-slide-up mb-0">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-10 bg-gray-600 rounded-full"></div>
            </div>
            <h2 className="text-center text-xl text-white mb-2">{selectedUpgrade}</h2>
            <p className="text-center text-gray-300 mb-4">Level: {upgrades[selectedUpgrade] || 1}</p>
            <p className="text-center text-gray-400 mb-4">Описание улучшения.</p>
            {upgrades[selectedUpgrade] === 10 ? (
              <p className="text-center text-yellow-400 mb-4">Max level</p>
            ) : (
              <>
                <button className="w-full py-3 bg-yellow-500 text-black rounded-lg" onClick={handleUpgrade}>
                  Улучшить ({upgradeLevels[selectedUpgrade as keyof typeof upgradeLevels][(upgrades[selectedUpgrade] || 1)].cost} монет)
                </button>
              </>
            )}
            <button className="w-full py-2 mt-2 bg-gray-700 text-white rounded-lg" onClick={closeUpgradeMenu}>Закрыть</button>
          </div>
        </div>
      )}
    </>
  );
};

export default MineContent;
