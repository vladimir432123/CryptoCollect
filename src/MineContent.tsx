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

  // Новые состояния для заработанных монет и таймера
  const [earnedCoins, setEarnedCoins] = useState<number>(() => {
    const saved = localStorage.getItem('earnedCoins');
    return saved ? parseInt(saved) : 0;
  });
  const [timer, setTimer] = useState<number>(() => {
    const saved = localStorage.getItem('timer');
    return saved ? parseInt(saved) : 10800; // 3 часа в секундах
  });
  const timerRef = useRef<number | null>(null);

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

  // Функция для получения данных пользователя с сервера
  const fetchUserData = async () => {
    if (userId === null) return;

    try {
      const response = await fetch(`/app?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }

      const data = await response.json();

      const { entryTime, exitTime } = data;

      if (entryTime && exitTime) {
        const exitDate = new Date(exitTime);
        const currentDate = new Date();

        const diffInSeconds = Math.floor((currentDate.getTime() - exitDate.getTime()) / 1000);

        const totalAccumulationTime = 10800; // 3 часа в секундах

        const newEarnedCoins = Math.min((diffInSeconds * incomePerHour) / 3600, incomePerHour * 3);
        const flooredEarnedCoins = Math.floor(newEarnedCoins);

        // Получаем существующие заработанные монеты из состояния
        const existingEarnedCoins = earnedCoins;

        // Добавляем новые заработанные монеты к существующим, с ограничением до 3 часов
        const updatedEarnedCoins = Math.min(existingEarnedCoins + flooredEarnedCoins, incomePerHour * 3);
        setEarnedCoins(updatedEarnedCoins);
        localStorage.setItem('earnedCoins', updatedEarnedCoins.toString());

        // Рассчитываем оставшееся время на таймере
        const additionalTime = Math.floor((flooredEarnedCoins / incomePerHour) * 3600);
        const updatedTimer = Math.min(timer + additionalTime, totalAccumulationTime);
        setTimer(updatedTimer);
        localStorage.setItem('timer', updatedTimer.toString());
      }

    } catch (error) {
      console.error('Ошибка при получении данных пользователя:', error);
    }
  };

  useEffect(() => {
    // При монтировании компонента
    fetchUserData();
  }, [userId, incomePerHour]);

  useEffect(() => {
    // Обновляем доход при изменении улучшений или уровня фермы
    const totalIncome = calculateTotalIncome(upgrades, farmLevel);
    setIncomePerHour(totalIncome);
  }, [upgrades, farmLevel, setIncomePerHour]);

  useEffect(() => {
    // Таймер для накопления монет
    if (timer > 0) {
      timerRef.current = window.setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer > 0) {
            const newTimer = prevTimer - 1;
            localStorage.setItem('timer', newTimer.toString());
            return newTimer;
          } else {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            return 0;
          }
        });

        setEarnedCoins((prevEarnedCoins) => {
          const increment = incomePerHour / 3600;
          const newEarnedCoins = Math.min(prevEarnedCoins + increment, incomePerHour * 3);
          localStorage.setItem('earnedCoins', Math.floor(newEarnedCoins).toString());
          return newEarnedCoins;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timer, incomePerHour]);

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
  ];

  // Функция форматирования времени
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Функция для обработки нажатия кнопки "Забрать"
  const handleCollectCoins = async () => {
    if (earnedCoins <= 0) return;

    try {
      // Добавить заработанные монеты к points
      const newPoints = points + earnedCoins;
      setPoints(newPoints);
      setEarnedCoins(0);
      setTimer(10800); // Сбросить таймер на 3 часа
      localStorage.setItem('earnedCoins', '0');
      localStorage.setItem('timer', '10800');

      // Обновить entryTime на сервере
      await fetch('/save-entry-exit-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'enter',
        }),
      });

      // Сохранить обновленные данные на сервере
      await fetch('/save-data', {
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
          farmLevel,
          incomePerHour,
        }),
      });

      alert('Монеты успешно забраны!');
    } catch (error) {
      console.error('Ошибка при сборе монет:', error);
      alert('Ошибка при сборе монет. Попробуйте снова.');
    }
  };

  // Новое меню внизу страницы с отступом 100 пикселей выше навигационной панели
  const renderBottomMenu = () => {
    return (
      <div className="fixed left-0 right-0 px-4 z-40" style={{ bottom: '100px' }}>
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-4 flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-2">
            <svg
              className="w-6 h-6 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.104 0-2 .896-2 2s.896 2 2 2 2-.896 2-2-.896-2-2-2zm0 6c-1.104 0-2 .896-2 2s.896 2 2 2 2-.896 2-2-.896-2-2-2z"
              />
            </svg>
            <span className="text-white text-lg font-semibold">{Math.floor(earnedCoins).toLocaleString()} монет</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-white text-sm">Осталось времени:</span>
            <span className="text-yellow-400 text-xl font-bold">{formatTime(timer)}</span>
          </div>
          <button
            onClick={handleCollectCoins}
            className={`w-full bg-yellow-500 hover:bg-yellow-600 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ${
              earnedCoins > 0 ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
            }`}
            disabled={earnedCoins <= 0}
          >
            Забрать
          </button>
        </div>
      </div>
    );
  };

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

      {/* Новое нижнее меню */}
      {renderBottomMenu()}
    </>
  );
};

export default MineContent;
