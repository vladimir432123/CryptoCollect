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
  tapProfitLevel: number;
  tapIncreaseLevel: number;
  remainingClicks: number;
  upgrades: { [key: string]: number };
  setUpgrades: React.Dispatch<React.SetStateAction<{ [key: string]: number }>>;
  farmLevel: number;
  setFarmLevel: React.Dispatch<React.SetStateAction<number>>;
}

const farmLevelMultipliers = [1, 1.2, 1.4, 1.6, 1.8, 2.0]; // Пример множителей для уровней фермы

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
}) => {
  const [isUpgradeMenuOpen, setIsUpgradeMenuOpen] = useState(false);
  const [isFarmLevelMenuOpen, setIsFarmLevelMenuOpen] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [totalIncome, setTotalIncome] = useState<number>(0);

  useEffect(() => {
    setTotalIncome(calculateTotalIncome(upgrades, farmLevel));
  }, [upgrades, farmLevel]);

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
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [totalIncome, setPoints]);

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
      closeFarmLevelMenu();
    }
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

          if ('profit' in upgradeData) {
            setTotalIncome(calculateTotalIncome(newUpgrades, farmLevel));
          }

          const newPoints = points - upgradeData.cost;
          setPoints(newPoints);
          setNotificationMessage(`Улучшено ${selectedUpgrade} до уровня ${nextLevel}`);
          closeUpgradeMenu();

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
          alert('Недостаточно очков для улучшения');
        }
      }
    }
  };

  const handleFarmLevelClick = () => {
    setIsFarmLevelMenuOpen(true);
  };

  const closeFarmLevelMenu = () => {
    setIsFarmLevelMenuOpen(false);
  };

  const handleFarmUpgrade = () => {
    if (farmLevel < 5 && userId !== null) {
      const nextLevel = farmLevel + 1;
      const upgradeData = upgradeLevels.farmlevel[nextLevel - 1];
      if (points >= upgradeData.cost) {
        const newPoints = points - upgradeData.cost;
        setFarmLevel(nextLevel);
        setPoints(newPoints);
        setTotalIncome(calculateTotalIncome(upgrades, nextLevel));
        setNotificationMessage(`Уровень фермы улучшен до ${nextLevel}`);

        // Сохранение изменений на сервере
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
        alert('Недостаточно очков для улучшения');
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
        <button
          className="w-full h-20 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg shadow-lg overflow-hidden relative"
          onClick={handleFarmLevelClick}
        >
          <div className="absolute top-0 left-0 w-full h-full bg-yellow-400 opacity-10"></div>
          <div className="flex flex-col justify-between h-full p-3">
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold text-gray-300">Уровень Фермы</span>
              <span className="text-xs font-medium text-yellow-400 bg-gray-800 px-2 py-1 rounded-full">
                Активно
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-2xl font-bold text-white">Уровень {farmLevel}</span>
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
      <div className="mt-2.5 px-4">
        <div className="h-[50px] bg-gray-700 rounded-lg flex">
          <div className="flex-1 flex items-center justify-center border-r border-gray-600">
            <span className="text-sm text-gray-300">
              Монеты: {Math.floor(points).toLocaleString()}
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-400">Доход</span>
            <span className="text-sm text-gray-300">{totalIncome.toFixed(2)} / час</span>
          </div>
        </div>
      </div>
      <div className="mt-5 px-4 grid grid-cols-2 gap-2.5 scrollable-upgrades">
        {upgradesList.map((upgrade, index) => (
          <button
            key={index}
            className="w-[100%] h-[100px] bg-gray-700 rounded-lg flex flex-col items-center justify-center bg-cover bg-center"
            style={{ backgroundImage: 'url(/path/to/placeholder.png)' }}
            onClick={() => handleUpgradeClick(upgrade)}
          >
            <span className="text-sm text-white">{upgrade}</span>
            <span className="text-xs text-gray-300">Уровень {upgrades[upgrade] || 1}</span>
          </button>
        ))}
      </div>

      {isUpgradeMenuOpen && selectedUpgrade && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
          onClick={handleOverlayClick}
        >
          <div className="bg-gray-800 w-full max-w-md p-9 rounded-t-lg animate-slide-up mb-0">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-10 bg-gray-600 rounded-full"></div>
            </div>
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
                      (upgrades[selectedUpgrade] || 1)
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
      )}

      {isFarmLevelMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleOverlayClick}
        >
          <div className="bg-gray-800 w-full max-w-md p-6 rounded-lg animate-slide-up">
            <h2 className="text-center text-xl text-white mb-4">Уровень Фермы</h2>
            <p className="text-left text-white mb-4">
              Краткое описание уровня фермы. Здесь можно написать информацию о преимуществах повышения уровня фермы.
            </p>
            <div className="text-center text-white mb-4">
              {farmLevel < 5 ? (
                <p>Следующий множитель: {farmLevelMultipliers[farmLevel + 1]}x</p>
              ) : (
                <p>Максимальный уровень достигнут</p>
              )}
            </div>
            <div className="relative w-full h-4 bg-gray-700 rounded-full overflow-hidden mb-4">
              <div
                className="absolute top-0 left-0 h-full bg-yellow-500 rounded-full"
                style={{ width: `${(farmLevel / 5) * 100}%` }}
              ></div>
              {[...Array(5)].map((_, index) => (
                <div
                  key={index}
                  className="absolute top-0 left-[calc(20%*index)] h-full w-0.5 bg-gray-600"
                ></div>
              ))}
            </div>
            {farmLevel < 5 ? (
              <button className="w-full py-3 bg-yellow-600 text-black rounded-lg" onClick={handleFarmUpgrade}>
                Улучшить ({upgradeLevels.farmlevel[farmLevel].cost} монет)
              </button>
            ) : (
              <p className="text-center text-yellow-400">Максимальный уровень достигнут</p>
            )}
            <button
              className="w-full py-2 mt-2 bg-gray-700 text-white rounded-lg"
              onClick={closeFarmLevelMenu}
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
