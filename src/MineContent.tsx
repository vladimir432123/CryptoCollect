// src/MineContent.tsx

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
}) => {
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [isUpgradesMenuOpen, setIsUpgradesMenuOpen] = useState(false);
  const [selectedMineUpgrade, setSelectedMineUpgrade] = useState<string | null>(null);

  // Состояние для времени последнего сбора монет
  const [lastCollectTime, setLastCollectTime] = useState<number>(Date.now());
  const MAX_ACCUMULATION_TIME = 3 * 60 * 60 * 1000; // 3 часа в миллисекундах

  const [earnedCoins, setEarnedCoins] = useState<number>(0);
  const [timer, setTimer] = useState<number>(MAX_ACCUMULATION_TIME);

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

  // Предзагрузка изображений при загрузке страницы
  useEffect(() => {
    const preloadImages = () => {
      upgradesList.forEach((upgrade) => {
        const img = new Image();
        img.src = `/images/${upgrade}.png`;
      });
    };
    preloadImages();
  }, []);

  useEffect(() => {
    // Обновляем доход при изменении улучшений или уровня фермы
    const totalIncome = calculateTotalIncome(upgrades, farmLevel);
    setIncomePerHour(totalIncome);
  }, [upgrades, farmLevel, setIncomePerHour]);

  // Функция для вычисления накопленных монет
  const calculateEarnedCoins = (elapsedTime: number) => {
    const accumulationTime = Math.min(elapsedTime, MAX_ACCUMULATION_TIME);
    const earned = (incomePerHour / 3600) * (accumulationTime / 1000);
    return Math.floor(earned);
  };

  // Функция для вычисления оставшегося времени
  const calculateRemainingTime = (elapsedTime: number) => {
    const remainingTime = MAX_ACCUMULATION_TIME - elapsedTime;
    return Math.max(remainingTime, 0);
  };

  useEffect(() => {
    const fetchLastCollectTime = async () => {
      if (userId === null) return;

      try {
        const response = await fetch(`/get-last-collect-time?userId=${userId}`);
        const data = await response.json();

        if (data && data.lastCollectTime) {
          const serverLastCollectTime = new Date(data.lastCollectTime).getTime();
          setLastCollectTime(serverLastCollectTime);

          const currentTime = Date.now();
          const elapsedTime = currentTime - serverLastCollectTime;

          setEarnedCoins(calculateEarnedCoins(elapsedTime));
          setTimer(calculateRemainingTime(elapsedTime));
        } else {
          // Если нет данных, устанавливаем текущее время
          setLastCollectTime(Date.now());
        }
      } catch (error) {
        console.error('Ошибка при получении времени последнего сбора монет:', error);
      }
    };

    fetchLastCollectTime();
  }, [userId, incomePerHour]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const elapsedTime = currentTime - lastCollectTime;

      setEarnedCoins(calculateEarnedCoins(elapsedTime));
      setTimer(calculateRemainingTime(elapsedTime));
    }, 60000); // Обновляем каждую минуту

    return () => clearInterval(interval);
  }, [lastCollectTime, incomePerHour]);

  const handleUpgradeClick = (upgrade: string) => {
    setSelectedMineUpgrade(upgrade);
    setIsUpgradesMenuOpen(false); // Закрываем меню улучшений
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
          setNotificationMessage(`Улучшено ${selectedMineUpgrade} до уровня ${nextLevel}`);

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
              lastCollectTime,
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

  // Список улучшений без 'farmlevel'
  const upgradesList = [
    'upgrade1',
    'upgrade2',
    'upgrade3',
    'upgrade4',
    'upgrade5',
    'upgrade6',
    'upgrade7',
    'upgrade8',
    // Добавьте больше улучшений при необходимости
  ];

  // Функция форматирования времени (только часы)
  const formatTime = (milliseconds: number) => {
    const hours = Math.ceil(milliseconds / (60 * 60 * 1000));
    return `${hours} ч.`;
  };

  // Функция для обработки нажатия кнопки "Забрать"
  const handleCollectCoins = async () => {
    const currentTime = Date.now();
    const elapsedTime = currentTime - lastCollectTime;
    const earned = calculateEarnedCoins(elapsedTime);

    if (earned <= 0) return;

    try {
      const newPoints = points + earned;
      setPoints(newPoints);
      setEarnedCoins(0);
      setLastCollectTime(currentTime);
      setTimer(MAX_ACCUMULATION_TIME);

      // Сохраняем данные на сервере
      await fetch('/collect-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          points: newPoints,
          lastCollectTime: new Date(currentTime).toISOString(),
        }),
      });

      alert('Монеты успешно забраны!');
    } catch (error) {
      console.error('Ошибка при сборе монет:', error);
      alert('Ошибка при сборе монет. Попробуйте снова.');
    }
  };

  // Обновляем lastCollectTime на сервере при выходе со страницы
  useEffect(() => {
    return () => {
      if (userId !== null) {
        fetch('/update-last-collect-time', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            lastCollectTime: new Date(lastCollectTime).toISOString(),
          }),
        }).catch((error) => console.error('Ошибка при обновлении времени последнего сбора:', error));
      }
    };
  }, [userId, lastCollectTime]);

  return (
    <>
      {notificationMessage && <UpgradeNotification message={notificationMessage} />}
      <div className="flex flex-col h-full pb-16"> {/* Добавили pb-16 */}
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
            className="w-full h-20 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg shadow-lg overflow-hidden relative flex items-center justify-between px-4"
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
                  {/* Иконка */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v8m-4-4h8"
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
              className="bg-gray-900 w-full max-w-md p-6 rounded-t-lg animate-slide-up flex flex-col"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: '90%' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl text-white">Улучшения</h2>
                <button className="text-gray-400" onClick={closeUpgradesMenu}>
                  ✕
                </button>
              </div>
              {/* Список улучшений со скроллингом */}
              <div className="grid grid-cols-2 gap-4 overflow-y-auto flex-grow">
                {upgradesList.map((upgrade, index) => (
                  <button
                    key={index}
                    className="w-full h-[120px] bg-gray-800 rounded-lg flex flex-col items-center justify-center"
                    onClick={() => handleUpgradeClick(upgrade)}
                  >
                    {/* Добавьте изображения или иконки для каждого улучшения */}
                    <div className="mb-2">
                      <img
                        src={`/images/${upgrade}.png`}
                        alt={upgrade}
                        className="w-12 h-12"
                      />
                    </div>
                    <span className="text-sm text-white">{`Улучшение ${index + 1}`}</span>
                    <span className="text-xs text-gray-300">
                      Уровень {upgrades[upgrade] || 1}
                    </span>
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
              <h2 className="text-center text-xl text-white mb-2">{`Улучшение ${selectedMineUpgrade}`}</h2>
              <p className="text-center text-gray-300 mb-4">
                Уровень: {upgrades[selectedMineUpgrade] || 1}
              </p>
              <p className="text-center text-gray-400 mb-4">
                {/* Здесь можно добавить индивидуальное описание для каждого улучшения */}
                Описание улучшения. Это улучшение поможет вам увеличить производительность и заработать больше монет.
              </p>
              {upgrades[selectedMineUpgrade] === 10 ? (
                <p className="text-center text-yellow-400 mb-4">Максимальный уровень</p>
              ) : (
                <>
                  <button
                    className="w-full py-3 bg-yellow-500 text-black rounded-lg"
                    onClick={handleUpgrade}
                  >
                    Улучшить (
                    {
                      upgradeLevels[selectedMineUpgrade as keyof typeof upgradeLevels][
                        upgrades[selectedMineUpgrade]
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

        {/* Перемещаем блок вниз */}
        <div className="mt-auto px-4 mb-20"> {/* Добавили mt-auto и mb-20 */}
          <div className="bg-gray-700 rounded-lg p-4 flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-2">
              <svg
                className="w-6 h-6 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {/* Иконка монеты */}
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.104 0-2 .896-2 2s.896 2 2 2 2-.896 2-2-.896-2-2-2z"
                />
              </svg>
              <span className="text-white text-lg font-semibold">
                {earnedCoins.toLocaleString()} монет
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-gray-300 text-sm">Осталось времени:</span>
              <span className="text-yellow-400 text-xl font-bold">{formatTime(timer)}</span>
            </div>
          </div>

          {/* Кнопка "Забрать" */}
          <button
            onClick={handleCollectCoins}
            className={`w-full py-3 mt-4 bg-yellow-500 text-black rounded-lg font-bold hover:bg-yellow-600 ${
              earnedCoins > 0 ? '' : 'opacity-50 cursor-not-allowed'
            }`}
            disabled={earnedCoins <= 0}
          >
            Забрать
          </button>
        </div>
      </div>
    </>
  );
};

export default MineContent;
