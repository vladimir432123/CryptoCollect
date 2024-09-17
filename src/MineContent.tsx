// MineContent.tsx

import React, { useEffect, useState, useCallback } from 'react';
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
  const [earnedCoins, setEarnedCoins] = useState<number>(0);
  const [timer, setTimer] = useState<number>(10800); // 3 часа в секундах

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

  // Инициализация дохода при изменении улучшений или уровня фермы
  useEffect(() => {
    const totalIncome = calculateTotalIncome(upgrades, farmLevel);
    setIncomePerHour(totalIncome);
  }, [upgrades, farmLevel, setIncomePerHour]);

  // Обновление earnedCoins каждые секунду, пока таймер > 0
  useEffect(() => {
    if (incomePerHour > 0 && timer > 0) {
      const interval = setInterval(() => {
        setEarnedCoins((prevEarnedCoins) => {
          const incomePerSecond = incomePerHour / 3600;
          const newEarnedCoins = prevEarnedCoins + incomePerSecond;
          const maxEarnedCoins = incomePerHour * 3;
          return newEarnedCoins > maxEarnedCoins ? maxEarnedCoins : newEarnedCoins;
        });

        setTimer((prevTimer) => (prevTimer > 0 ? prevTimer - 1 : 0));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [incomePerHour, timer]);

  // Форматирование времени из секунд в HH:MM:SS
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Функция для сбора заработанных монет
  const handleCollect = useCallback(() => {
    if (earnedCoins > 0) {
      const totalPoints = points + earnedCoins;
      setPoints(totalPoints);
      setEarnedCoins(0);
      setTimer(10800); // Сброс таймера на 3 часа

      // Сохраняем данные на сервере
      fetch('/save-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          points: totalPoints,
          earnedCoins: 0,
          timer: 10800,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            console.log('Данные сохранены после сбора монет:', data);
          } else {
            console.error('Ошибка на сервере при сохранении данных после сбора:', data.error);
            alert('Ошибка сохранения данных. Попробуйте снова.');
          }
        })
        .catch((error) => {
          console.error('Ошибка при сохранении данных после сбора:', error);
          alert('Ошибка сохранения данных. Попробуйте снова.');
        });
    }
  }, [earnedCoins, points, setPoints, userId]);

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    if (userId !== null) {
      fetch(`/app?userId=${userId}`)
        .then((response) => response.json())
        .then((data) => {
          const savedEarnedCoins = data.earnedCoins || 0;
          const savedTimer = data.timer !== undefined ? data.timer : 10800;
          const exitTime = data.exitTime ? new Date(data.exitTime) : null;
          const now = new Date();

          let timeElapsed = 0;
          if (exitTime) {
            timeElapsed = Math.floor((now.getTime() - exitTime.getTime()) / 1000); // в секундах
          }

          let adjustedTimer = savedTimer - timeElapsed;
          if (adjustedTimer < 0) {
            adjustedTimer = 0;
          }
          setTimer(adjustedTimer);

          const incomePerSecond = incomePerHour / 3600;
          let additionalEarnedCoins = incomePerSecond * Math.min(timeElapsed, savedTimer);
          const totalEarnedCoins = Math.min(savedEarnedCoins + additionalEarnedCoins, incomePerHour * 3);
          setEarnedCoins(totalEarnedCoins);
        })
        .catch((error) => console.error('Ошибка при загрузке данных с сервера:', error));
    }

    // Отправляем действие 'enter' на сервер при монтировании
    if (userId !== null) {
      fetch('/save-entry-exit-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'enter',
        }),
      }).catch((error) => console.error('Ошибка при сохранении времени входа:', error));
    }

    // Отправляем действие 'exit' с earnedCoins и timer при размонтировании
    return () => {
      if (userId !== null) {
        fetch('/save-entry-exit-time', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            action: 'exit',
            earnedCoins,
            timer,
          }),
        }).catch((error) => console.error('Ошибка при сохранении времени выхода:', error));
      }
    };
  }, [userId, incomePerHour, earnedCoins, timer]);

  // Обработчики меню улучшений
  const handleUpgradeClick = (upgrade: string) => {
    setSelectedMineUpgrade(upgrade);
    setIsUpgradesMenuOpen(false);
  };

  const closeUpgradeMenu = () => {
    setSelectedMineUpgrade(null);
  };

  const closeUpgradesMenu = () => {
    setIsUpgradesMenuOpen(false);
  };

  // Обработчик улучшения
  const handleUpgrade = () => {
    if (selectedMineUpgrade) {
      const currentLevel = upgrades[selectedMineUpgrade] || 1;

      if (currentLevel < 10) {
        const nextLevel = currentLevel + 1;
        const upgradeData = upgradeLevels[selectedMineUpgrade as keyof typeof upgradeLevels][nextLevel - 1];

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
              earnedCoins,
              timer,
            }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                console.log('Данные успешно сохранены.');
              } else {
                console.error('Ошибка на сервере: данные не были сохранены', data.error);
                alert('Ошибка сохранения данных. Попробуйте снова.');
              }
            })
            .catch((error) => {
              console.error('Ошибка сохранения данных:', error);
              alert('Ошибка сохранения данных. Попробуйте снова.');
            });
        } else {
          alert('Недостаточно монет для улучшения');
        }
      } else {
        alert('Максимальный уровень достигнут');
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
            {/* Список улучшений со скроллингом */}
            <div className="grid grid-cols-2 gap-4 overflow-y-auto" style={{ maxHeight: '75vh' }}>
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

      {/* Новое меню для отображения заработанных монет и таймера */}
      <div className="fixed bottom-20 left-0 right-0 px-4">
        <div className="bg-gray-700 rounded-lg p-4 flex flex-col items-center">
          <p className="text-yellow-400 text-2xl mb-2">
            {Math.floor(earnedCoins).toLocaleString()} монет
          </p>
          <p className="text-gray-300 text-lg mb-2">Таймер: {formatTime(timer)}</p>
          <button
            className="bg-yellow-500 text-gray-900 px-4 py-2 rounded-full font-bold shadow-lg"
            onClick={handleCollect}
            disabled={earnedCoins === 0}
          >
            Забрать
          </button>
        </div>
      </div>
    </>
  );
};

export default MineContent;
