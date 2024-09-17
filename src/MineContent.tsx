import React, { useEffect, useState } from 'react';
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
  selectedUpgrade: string | null;
  setSelectedUpgrade: React.Dispatch<React.SetStateAction<string | null>>;
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
  setFarmLevel,
  incomePerHour,
  setIncomePerHour,
  selectedUpgrade,
  setSelectedUpgrade,
}) => {
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [isUpgradesMenuOpen, setIsUpgradesMenuOpen] = useState(false);

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

  useEffect(() => {
    const incomePerSecond = incomePerHour / 3600;
    if (incomePerHour > 0) {
      const interval = setInterval(() => {
        setPoints((prevPoints: number) => prevPoints + incomePerSecond);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [incomePerHour, setPoints]);

  const handleUpgradeClick = (upgrade: string) => {
    setSelectedUpgrade(upgrade);
  };

  const closeUpgradeMenu = () => {
    setSelectedUpgrade(null);
  };

  const closeUpgradesMenu = () => {
    setIsUpgradesMenuOpen(false);
  };

  const handleUpgrade = () => {
    if (selectedUpgrade) {
      const currentLevel = upgrades[selectedUpgrade] || 1;
      if (currentLevel < 10) {
        const nextLevel = currentLevel + 1;
        const upgradeData = upgradeLevels[selectedUpgrade as keyof typeof upgradeLevels][nextLevel - 1];

        if (points >= upgradeData.cost) {
          const newUpgrades = {
            ...upgrades,
            [selectedUpgrade]: nextLevel,
          };
          setUpgrades(newUpgrades);

          const newPoints = points - upgradeData.cost;
          setPoints(newPoints);
          setNotificationMessage(`Улучшено ${selectedUpgrade} до уровня ${nextLevel}`);

          // Обновляем incomePerHour
          const totalIncome = calculateTotalIncome(newUpgrades, farmLevel);
          setIncomePerHour(totalIncome);

          // Сохранение данных на сервере
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
          alert('Недостаточно монет для улучшения');
        }
      }
    }
  };

  const handleFarmUpgrade = () => {
    if (farmLevel < farmLevelMultipliers.length && userId !== null) {
      const nextLevel = farmLevel + 1;
      const upgradeData = upgradeLevels.farmlevel[nextLevel - 1];
      if (points >= upgradeData.cost) {
        const newPoints = points - upgradeData.cost;
        setFarmLevel(nextLevel);
        setPoints(newPoints);
        setNotificationMessage(`Уровень фермы улучшен до ${nextLevel}`);

        // Обновляем incomePerHour
        const totalIncome = calculateTotalIncome(upgrades, nextLevel);
        setIncomePerHour(totalIncome);

        // Сохранение данных на сервере
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
            ...upgrades,
            farmLevel: nextLevel,
            incomePerHour: totalIncome,
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
              console.log('Уровень фермы успешно сохранён.');
            } else {
              console.error('Ошибка на сервере: данные не были сохранены');
            }
          })
          .catch((error) => console.error('Ошибка сохранения уровня фермы:', error));
      } else {
        alert('Недостаточно монет для улучшения');
      }
    }
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
      <div className="px-4 mt-4">
        {/* Кнопка Farm Level */}
        <button
          className="w-full h-20 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg shadow-lg overflow-hidden relative mb-4"
          onClick={() => handleUpgradeClick('farmlevel')}
        >
          <div className="absolute top-0 left-0 w-full h-full bg-yellow-400 opacity-10"></div>
          <div className="flex flex-col justify-between h-full p-3">
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold text-gray-300">Farm Level</span>
              <span className="text-xs font-medium text-yellow-400 bg-gray-800 px-2 py-1 rounded-full">
                Уровень {farmLevel}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-2xl font-bold text-white">Улучшить Ферму</span>
              <svg
                className="w-6 h-6 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </button>
        {/* Кнопка Upgrades */}
        <button
          className="w-full h-20 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg shadow-lg overflow-hidden relative"
          onClick={() => setIsUpgradesMenuOpen(true)}
        >
          <div className="absolute top-0 left-0 w-full h-full bg-yellow-400 opacity-10"></div>
          <div className="flex flex-col justify-between h-full p-3">
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold text-gray-300">Upgrades</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-2xl font-bold text-white">Просмотр улучшений</span>
              <svg
                className="w-6 h-6 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      {isUpgradesMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
          onClick={closeUpgradesMenu}
        >
          <div
            className="bg-gray-800 w-full max-w-md p-6 rounded-t-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90%' }} // Настройка высоты для покрытия большей части экрана
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-white">Улучшения</h2>
              <button className="text-gray-400" onClick={closeUpgradesMenu}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 overflow-y-auto" style={{ maxHeight: '75vh' }}>
              {upgradesList.map((upgrade, index) => (
                <button
                  key={index}
                  className="w-full h-[100px] bg-gray-700 rounded-lg flex flex-col items-center justify-center bg-cover bg-center"
                  style={{ backgroundImage: 'url(/path/to/placeholder.png)' }}
                  onClick={() => handleUpgradeClick(upgrade)}
                >
                  <span className="text-sm text-white">{upgrade}</span>
                  <span className="text-xs text-gray-300">
                    Уровень {upgrades[upgrade] || 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedUpgrade && (
        selectedUpgrade !== 'farmlevel' && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
            onClick={closeUpgradeMenu}
          >
            <div
              className="bg-gray-800 w-full max-w-md p-6 rounded-t-lg animate-slide-up"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: '90%' }}
            >
              <h2 className="text-center text-xl text-white mb-2">{selectedUpgrade}</h2>
              <p className="text-center text-gray-300 mb-4">
                Уровень: {upgrades[selectedUpgrade] || 1}
              </p>
              <p className="text-center text-gray-400 mb-4">
                Описание улучшения. Это улучшение поможет вам увеличить производительность и заработать больше монет.
              </p>
              {upgrades[selectedUpgrade] === 10 ? (
                <p className="text-center text-yellow-400 mb-4">Максимальный уровень</p>
              ) : (
                <>
                  <button
                    className="w-full py-3 bg-yellow-500 text-black rounded-lg"
                    onClick={handleUpgrade}
                  >
                    Улучшить (
                    {
                      upgradeLevels[selectedUpgrade as keyof typeof upgradeLevels][
                        upgrades[selectedUpgrade]
                      ].cost
                    }{' '}
                    монет)
                  </button>
                </>
              )}
              <button
                className="w-full py-2 mt-2 bg-gray-700 text-white rounded-lg"
                onClick={closeUpgradeMenu}
              >
                Закрыть
              </button>
            </div>
          </div>
        )
      )}

      {selectedUpgrade === 'farmlevel' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
          onClick={closeUpgradeMenu}
        >
          <div
            className="bg-gray-800 w-full max-w-md p-6 rounded-t-lg animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90%' }}
          >
            <h2 className="text-center text-xl text-white mb-2">Farm Level</h2>
            <p className="text-center text-gray-300 mb-4">
              Уровень: {farmLevel}
            </p>
            <p className="text-center text-gray-400 mb-4">
              Улучшите ферму, чтобы увеличить общую производительность.
            </p>
            {farmLevel === farmLevelMultipliers.length ? (
              <p className="text-center text-yellow-400 mb-4">Максимальный уровень</p>
            ) : (
              <>
                <button
                  className="w-full py-3 bg-yellow-500 text-black rounded-lg"
                  onClick={handleFarmUpgrade}
                >
                  Улучшить (
                  {
                    upgradeLevels['farmlevel'][farmLevel].cost
                  }{' '}
                  монет)
                </button>
              </>
            )}
            <button
              className="w-full py-2 mt-2 bg-gray-700 text-white rounded-lg"
              onClick={closeUpgradeMenu}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MineContent;
