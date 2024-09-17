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
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

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
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeMenu = () => {
    setSelectedUpgrade(null);
    setIsUpgradeModalOpen(false);
  };

  const closeUpgradesMenu = () => {
    setIsUpgradesMenuOpen(false);
  };

  const handleUpgrade = () => {
    if (selectedUpgrade) {
      let currentLevel =
        selectedUpgrade === 'farmlevel' ? farmLevel : upgrades[selectedUpgrade] || 1;

      if (currentLevel < 10) {
        const nextLevel = currentLevel + 1;
        const upgradeData =
          upgradeLevels[selectedUpgrade as keyof typeof upgradeLevels][nextLevel - 1];

        if (points >= upgradeData.cost) {
          const newPoints = points - upgradeData.cost;
          setPoints(newPoints);

          if (selectedUpgrade === 'farmlevel') {
            setFarmLevel(nextLevel);
            setNotificationMessage(`Уровень фермы улучшен до ${nextLevel}`);
          } else {
            const newUpgrades = {
              ...upgrades,
              [selectedUpgrade]: nextLevel,
            };
            setUpgrades(newUpgrades);
            setNotificationMessage(`Улучшено ${selectedUpgrade} до уровня ${nextLevel}`);
          }

          // Обновляем incomePerHour
          const totalIncome = calculateTotalIncome(
            selectedUpgrade === 'farmlevel' ? upgrades : { ...upgrades, [selectedUpgrade]: nextLevel },
            selectedUpgrade === 'farmlevel' ? nextLevel : farmLevel
          );
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
              ...(selectedUpgrade === 'farmlevel' ? { farmLevel: nextLevel } : {}),
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
                console.log('Данные успешно сохранены.');
              } else {
                console.error('Ошибка на сервере: данные не были сохранены');
              }
            })
            .catch((error) => {
              console.error('Ошибка сохранения данных:', error);
              alert('Ошибка сохранения данных. Попробуйте снова.');
            });
        } else {
          alert('Недостаточно монет для улучшения');
        }
      }
    }
  };

  // Обновляем список улучшений, включая 'farmlevel'
  const upgradesList = [
    'farmlevel',
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
      {/* Блок с монетами и доходом в час */}
      <div className="px-4 mt-4">
        <div className="h-[50px] bg-gray-700 rounded-lg flex">
          <div className="flex-1 flex items-center justify-center border-r border-gray-600">
            <span className="text-sm text-gray-300">
              Монеты: {Math.floor(points).toLocaleString()}
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-400">Доход</span>
            <span className="text-sm text-gray-300">{incomePerHour.toFixed(2)} / час</span>
          </div>
        </div>
      </div>
      {/* Кнопка "Улучшения" */}
      <div className="px-4 mt-4">
        <button
          className="w-full h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg shadow-lg overflow-hidden relative flex items-center justify-between px-4"
          onClick={() => setIsUpgradesMenuOpen(true)}
        >
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-white bg-opacity-20 rounded-full">
              {/* Иконка улучшений */}
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Улучшения</span>
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
              <h2 className="text-xl text-white">Улучшения</h2>
              <button className="text-gray-400" onClick={closeUpgradesMenu}>
                ✕
              </button>
            </div>
            {/* Список улучшений */}
            <div className="grid grid-cols-2 gap-4 overflow-y-auto" style={{ maxHeight: '75vh' }}>
              {upgradesList.map((upgrade, index) => (
                <button
                  key={index}
                  className="w-full h-[120px] bg-gray-800 rounded-lg flex flex-col items-center justify-center"
                  onClick={() => handleUpgradeClick(upgrade)}
                >
                  {/* Вы можете добавить изображения или иконки для каждого улучшения */}
                  <div className="mb-2">
                    <img
                      src={`/images/${upgrade}.png`}
                      alt={upgrade}
                      className="w-12 h-12"
                    />
                  </div>
                  <span className="text-sm text-white">
                    {upgrade === 'farmlevel' ? 'Уровень Фермы' : `Улучшение ${index}`}
                  </span>
                  <span className="text-xs text-gray-300">
                    Уровень {upgrade === 'farmlevel' ? farmLevel : upgrades[upgrade] || 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isUpgradeModalOpen && selectedUpgrade && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeUpgradeMenu}
        >
          <div
            className="bg-gray-900 w-11/12 max-w-md p-6 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-center text-xl text-white mb-2">
              {selectedUpgrade === 'farmlevel' ? 'Уровень Фермы' : selectedUpgrade}
            </h2>
            <p className="text-center text-gray-300 mb-4">
              Уровень:{' '}
              {selectedUpgrade === 'farmlevel'
                ? farmLevel
                : upgrades[selectedUpgrade] || 1}
            </p>
            <p className="text-center text-gray-400 mb-4">
              {/* Здесь можно добавить индивидуальное описание для каждого улучшения */}
              Описание улучшения. Это улучшение поможет вам увеличить производительность и заработать больше монет.
            </p>
            {((selectedUpgrade !== 'farmlevel' && upgrades[selectedUpgrade] === 10) ||
            (selectedUpgrade === 'farmlevel' && farmLevel === farmLevelMultipliers.length)) ? (
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
                      (selectedUpgrade === 'farmlevel'
                        ? farmLevel
                        : upgrades[selectedUpgrade]) || 1
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
    </>
  );
};

export default MineContent;
