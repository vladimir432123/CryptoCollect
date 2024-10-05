// src/MineContent.tsx

import React, { useEffect, useState, useRef } from 'react';
import { upgradeLevels } from './upgrades';
import UpgradeNotification from './UpgradeNotification';
import './minecontent.css';
import { toast } from 'react-toastify';

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

  const [earnedCoins, setEarnedCoins] = useState<number>(() => {
    const savedEarnedCoins = localStorage.getItem('earnedCoins');
    return savedEarnedCoins ? parseFloat(savedEarnedCoins) : 0;
  });

  const farmLevelMultipliers = [1, 1.2, 1.4, 1.6, 1.8, 2.0];
  const [maxEarnedCoins, setMaxEarnedCoins] = useState<number>(incomePerHour * 3);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Инициализируем lastUpdateTime из localStorage при монтировании
  useEffect(() => {
    const savedTime = localStorage.getItem('lastUpdateTime');
    if (savedTime) {
      lastUpdateTimeRef.current = parseInt(savedTime);
    }
  }, []);

  const timerRef = useRef<number | null>(null);

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

  // Обновляем incomePerHour при изменении улучшений или уровня фермы
  useEffect(() => {
    const totalIncome = calculateTotalIncome(upgrades, farmLevel);
    setIncomePerHour(totalIncome);
    setMaxEarnedCoins(totalIncome * 3);
  }, [upgrades, farmLevel, setIncomePerHour]);

  // Функция для обновления накопленных монет
  const updateEarnedCoins = () => {
    const now = Date.now();
    const elapsedSeconds = (now - lastUpdateTimeRef.current) / 1000;
    const potentialEarned = (incomePerHour / 3600) * elapsedSeconds;
    const newEarnedCoins = Math.min(potentialEarned, maxEarnedCoins);

    setEarnedCoins(newEarnedCoins);

    // Сохраняем в localStorage
    localStorage.setItem('earnedCoins', newEarnedCoins.toString());
  };

  // При монтировании компонента обновляем накопленные монеты
  useEffect(() => {
    updateEarnedCoins();

    // Запускаем таймер для обновления монет каждую секунду
    timerRef.current = window.setInterval(() => {
      updateEarnedCoins();
    }, 1000); // Обновляем каждую секунду

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Сохраняем время выхода
      saveExitTime();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomePerHour]);

  // Сохранение времени выхода с MineContent
  const saveExitTime = () => {
    if (userId !== null) {
      fetch('/save-entry-exit-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'exit_mine',
          time: new Date().toISOString(),
        }),
      }).catch((error) => console.error('Ошибка при сохранении времени выхода из MineContent:', error));
    }
  };

  // При заходе на страницу MineContent, сохраняем время входа
  useEffect(() => {
    if (userId !== null) {
      fetch('/save-entry-exit-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'enter_mine',
          time: new Date().toISOString(),
        }),
      }).catch((error) => console.error('Ошибка при сохранении времени входа в MineContent:', error));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Предзагрузка изображений
  useEffect(() => {
    upgradesList.forEach((upgrade) => {
      const img = new Image();
      img.src = `/images/${upgrade}.png`;
    });
  }, []);

  const handleUpgradeClick = (upgrade: string) => {
    setSelectedMineUpgrade(upgrade);
    // Не закрываем основное меню улучшений
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
          setMaxEarnedCoins(totalIncome * 3);

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
              toast.error('Ошибка сохранения данных. Попробуйте снова.');
            });
        } else {
          toast.error('Недостаточно монет для улучшения');
        }
      }
    }
  };

  // Список улучшений
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

  // Функция для обработки нажатия кнопки "Забрать"
  const handleCollectCoins = async () => {
    const totalEarnedCoins = Math.floor(earnedCoins);
    if (totalEarnedCoins <= 0) return;

    try {
      // Добавить заработанные монеты к points
      const newPoints = points + totalEarnedCoins;
      setPoints(newPoints);

      // Сброс earnedCoins и lastUpdateTime
      setEarnedCoins(0);
      lastUpdateTimeRef.current = Date.now();
      localStorage.setItem('earnedCoins', '0');
      localStorage.setItem('lastUpdateTime', lastUpdateTimeRef.current.toString());

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

      toast.success('Монеты успешно забраны!');
    } catch (error) {
      console.error('Ошибка при сборе монет:', error);
      toast.error('Ошибка при сборе монет. Попробуйте снова.');
    }
  };

  // Расчет оставшегося времени до максимального накопления
  const remainingTime = () => {
    const remainingCoins = maxEarnedCoins - earnedCoins;
    const remainingSeconds = remainingCoins / (incomePerHour / 3600);
    const remainingHours = Math.ceil(remainingSeconds / 3600);
    return Math.min(3, Math.max(0, remainingHours));
  };

  return (
    <>
      {notificationMessage && <UpgradeNotification message={notificationMessage} />}
      {/* Убрали блок с именем пользователя */}
      
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
          className="w-full h-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg shadow-lg overflow-hidden relative flex items-center justify-between px-4"
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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

      {/* Меню улучшений */}
      {isUpgradesMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
          onClick={closeUpgradesMenu}
        >
          <div
            className="bg-gray-900 w-full max-w-md p-6 rounded-t-lg animate-slide-up flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh' }} // Ограничиваем высоту для прокрутки
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
                  className="w-full h-[150px] bg-gray-800 rounded-lg flex flex-col items-center justify-center"
                  onClick={() => handleUpgradeClick(upgrade)}
                >
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
            {/* Меню отдельного улучшения */}
            {selectedMineUpgrade && (
              <div
                className="bg-gray-800 w-full p-4 rounded-lg absolute bottom-0 left-0"
                style={{ marginBottom: '80px' }} // Подняли меню деталей улучшения
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-center text-xl text-white mb-2">{`Улучшение ${selectedMineUpgrade}`}</h2>
                <p className="text-center text-gray-300 mb-4">
                  Уровень: {upgrades[selectedMineUpgrade] || 1}
                </p>
                <p className="text-center text-gray-400 mb-4">
                  {/* Здесь можно добавить индивидуальное описание для каждого улучшения */}
                  Это улучшение увеличивает ваш пассивный доход, позволяя быстрее накапливать монеты.
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
            )}
          </div>
        </div>
      )}

      {/* Новый дизайн нижней панели */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 flex flex-col items-center"
        style={{ marginBottom: '100px' }} // Подняли на 100 пикселей
      >
        <div className="w-full bg-gray-700 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-white text-lg font-semibold">
                {Math.floor(earnedCoins).toLocaleString()} монет
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-white text-lg font-semibold">
                Осталось: {remainingTime()} ч
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleCollectCoins}
          className={`w-full py-3 mb-2 bg-yellow-500 text-black rounded-lg font-bold hover:bg-yellow-600 ${
            earnedCoins > 0 ? '' : 'opacity-50 cursor-not-allowed'
          }`}
          disabled={earnedCoins <= 0}
        >
          Забрать монеты
        </button>
      </div>
    </>
  );
};

export default MineContent;
