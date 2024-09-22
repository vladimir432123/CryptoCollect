// src/MineContent.tsx

import React, { useEffect, useState, useRef, useCallback } from 'react';
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

  // Константы
  const TOTAL_TIMER_SECONDS = 10800; // 3 часа в секундах

  // Состояния для заработанных монет и таймера
  const [earnedCoins, setEarnedCoins] = useState<number>(() => {
    const saved = localStorage.getItem('earnedCoins');
    return saved ? parseInt(saved) : 0;
  });

  // Оставшееся время таймера в секундах
  const [timer, setTimer] = useState<number>(0);

  const timerRef = useRef<number | null>(null);

  const farmLevelMultipliers = [1, 1.2, 1.4, 1.6, 1.8, 2.0];

  // Функция для расчета общего дохода
  const calculateTotalIncome = useCallback(
    (upgrades: { [key: string]: number }, farmLevel: number): number => {
      let income = 0;
      for (const [key, level] of Object.entries(upgrades)) {
        const upgradeLevel = upgradeLevels[key as keyof typeof upgradeLevels][level - 1];
        if ('profit' in upgradeLevel) {
          income += upgradeLevel.profit;
        }
      }
      return income * farmLevelMultipliers[farmLevel - 1];
    },
    [farmLevelMultipliers]
  );

  // Получение данных пользователя с сервера при монтировании компонента
  useEffect(() => {
    const fetchLastCollectTime = async () => {
      if (!userId) return;
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
        const lastCollectTimestamp = data.last_collect_time ? new Date(data.last_collect_time).getTime() : null;

        if (lastCollectTimestamp) {
          const now = Date.now();
          const elapsedSeconds = Math.floor((now - lastCollectTimestamp) / 1000);
          const remaining = TOTAL_TIMER_SECONDS - elapsedSeconds;
          setTimer(remaining > 0 ? remaining : 0);
        } else {
          // Если пользователь еще не собирал монеты, разрешаем сразу собрать
          setTimer(0);
        }
      } catch (error) {
        console.error('Ошибка при получении last_collect_time:', error);
      }
    };
    fetchLastCollectTime();
  }, [userId]);

  // Обновление дохода при изменении улучшений или уровня фермы
  useEffect(() => {
    const totalIncome = calculateTotalIncome(upgrades, farmLevel);
    setIncomePerHour(totalIncome);
  }, [upgrades, farmLevel, calculateTotalIncome, setIncomePerHour]);

  // Логика таймера
  useEffect(() => {
    if (timer > 0) {
      timerRef.current = window.setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer > 1) {
            return prevTimer - 1;
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

  // Обработчик кнопки "Забрать"
  const handleCollectCoins = async () => {
    if (earnedCoins <= 0) return;

    try {
      // Добавить заработанные монеты к points
      const newPoints = points + Math.floor(earnedCoins);
      setPoints(newPoints);
      setEarnedCoins(0);

      // Обновить last_collect_time на сервере
      const response = await fetch('/save-data', {
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
          last_collect_time: new Date().toISOString(), // Устанавливаем текущее время
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setTimer(TOTAL_TIMER_SECONDS);
      } else {
        throw new Error('Ошибка на сервере');
      }

      alert('Монеты успешно забраны!');
    } catch (error) {
      console.error('Ошибка при сборе монет:', error);
      alert('Ошибка при сборе монет. Попробуйте снова.');
    }
  };

  // Обработчики для меню улучшений
  const handleUpgradeClick = (upgrade: string) => {
    setSelectedMineUpgrade(upgrade);
    setIsUpgradesMenuOpen(false); // Закрываем меню улучшений
  };

  // Обработчик улучшений
  const handleUpgrade = async () => {
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

          // Обновляем доход
          const totalIncome = calculateTotalIncome(newUpgrades, farmLevel);
          setIncomePerHour(totalIncome);

          // Сохранение данных на сервере
          try {
            const response = await fetch('/save-data', {
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
            });

            if (!response.ok) {
              throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
              console.log('Данные успешно сохранены.');
            } else {
              console.error('Ошибка на сервере: данные не были сохранены');
            }
          } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            alert('Ошибка сохранения данных. Попробуйте снова.');
          }
        } else {
          alert('Недостаточно монет для улучшения');
        }
      }
    }
  };

  // Функция форматирования времени
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Рендер нижнего меню
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

  // Рендер меню улучшений
  const renderUpgradesMenu = () => (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setSelectedMineUpgrade(null)}
    >
      <div
        className="bg-gray-800 w-11/12 max-w-md p-6 rounded-lg animate-slide-up overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center text-xl text-white mb-4">
          {selectedMineUpgrade ? `Улучшение ${selectedMineUpgrade}` : ''}
        </h2>
        <p className="text-center text-gray-400 mb-4">
          {/* Добавьте индивидуальное описание для каждого улучшения */}
          {selectedMineUpgrade
            ? `Описание улучшения ${selectedMineUpgrade}. Это улучшение поможет вам увеличить производительность и заработать больше монет.`
            : ''}
        </p>
        <p className="text-center text-gray-300 mb-4">
          Текущий уровень: {selectedMineUpgrade ? (upgrades[selectedMineUpgrade] || 1) : ''}
        </p>
        {selectedMineUpgrade && (upgrades[selectedMineUpgrade] || 1) < 10 ? (
          <button
            className={`w-full py-3 bg-yellow-500 text-black rounded-lg ${
              points >= upgradeLevels[selectedMineUpgrade as keyof typeof upgradeLevels][(upgrades[selectedMineUpgrade] || 1) - 1].cost
                ? 'hover:bg-yellow-600'
                : 'opacity-50 cursor-not-allowed'
            }`}
            onClick={handleUpgrade}
            disabled={points < upgradeLevels[selectedMineUpgrade as keyof typeof upgradeLevels][(upgrades[selectedMineUpgrade] || 1) - 1].cost}
          >
            Улучшить за {upgradeLevels[selectedMineUpgrade as keyof typeof upgradeLevels][(upgrades[selectedMineUpgrade] || 1) - 1].cost} монет
          </button>
        ) : (
          <p className="text-center text-yellow-400 mt-4">Максимальный уровень достигнут</p>
        )}
        <button
          className="w-full py-2 mt-4 bg-gray-700 text-white rounded-lg"
          onClick={() => setSelectedMineUpgrade(null)}
        >
          Закрыть
        </button>
      </div>
    </div>
  );

  // Рендер основного содержимого
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
          onClick={() => setIsUpgradesMenuOpen(false)}
        >
          <div
            className="bg-gray-900 w-full max-w-md p-6 rounded-t-lg animate-slide-up overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90%' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-white">Улучшения</h2>
              <button className="text-gray-400" onClick={() => setIsUpgradesMenuOpen(false)}>
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

      {selectedMineUpgrade && renderUpgradesMenu()}

      {/* Нижнее меню */}
      {renderBottomMenu()}
    </>
  );
};

export default MineContent;
