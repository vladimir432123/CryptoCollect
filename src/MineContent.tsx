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
  const [timer, setTimer] = useState<number>(3600); // Таймер отсчета в секундах
  const farmLevelMultipliers = [1, 1.2, 1.4, 1.6, 1.8, 2.0];

  // Обрабатываем событие смены видимости страницы (блокировка/разблокировка)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Когда экран блокируется/уходит в фон, сохраняем текущее время
        localStorage.setItem('lastExitTime', new Date().toISOString());
      } else if (document.visibilityState === 'visible') {
        // При возвращении вычисляем разницу во времени и обновляем таймер
        const lastExitTime = localStorage.getItem('lastExitTime');
        if (lastExitTime) {
          const timeDiff = (new Date().getTime() - new Date(lastExitTime).getTime()) / 1000; // разница в секундах
          setTimer((prevTimer) => Math.max(prevTimer - timeDiff, 0));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Функция для расчета общего дохода с учетом улучшений и уровня фермы
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

  // Устанавливаем доход при изменении уровня фермы или улучшений
  useEffect(() => {
    const totalIncome = calculateTotalIncome(upgrades, farmLevel);
    setIncomePerHour(totalIncome);
    if (totalIncome > 0) {
      setTimer(3600); // Устанавливаем таймер на 1 час, когда доход больше 0
    }
  }, [upgrades, farmLevel, setIncomePerHour]);

  // Запускаем таймер для начисления монет
  useEffect(() => {
    if (incomePerHour > 0) {
      const incomePerSecond = incomePerHour / 3600;

      const interval = setInterval(() => {
        setPoints((prevPoints) => prevPoints + incomePerSecond);
        setTimer((prevTimer) => Math.max(prevTimer - 1, 0)); // Уменьшаем таймер на 1 сек
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [incomePerHour, setPoints]);

  // Обработчик для открытия меню улучшений
  const handleUpgradeClick = (upgrade: string) => {
    setSelectedMineUpgrade(upgrade);
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

          // Обновляем доход в час
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
          }).catch((error) => {
            console.error('Ошибка сохранения данных:', error);
            alert('Ошибка сохранения данных. Попробуйте снова.');
          });
        } else {
          alert('Недостаточно монет для улучшения');
        }
      }
    }
  };

  // Форматируем оставшееся время таймера
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
      <div className="px-4 mt-4">
        <div className="h-[50px] bg-gray-700 rounded-lg flex">
          <div className="flex-1 flex items-center justify-center border-r border-gray-600">
            <span className="text-sm text-gray-300">Монеты: {Math.floor(points).toLocaleString()}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-400">Доход</span>
            <span className="text-sm text-gray-300">
              {incomePerHour > 0 ? `${incomePerHour.toFixed(2)} / час` : 'нет дохода'}
            </span>
          </div>
        </div>
        {/* Отображение таймера */}
        <div className="flex flex-col items-center justify-center mt-2">
          <span className="text-xs text-gray-400">Оставшееся время</span>
          <span className="text-sm text-gray-300">{formatTime(timer)}</span>
        </div>
      </div>
      <div className="px-4 mt-4">
        <button
          className="w-full h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-lg shadow-lg overflow-hidden relative flex items-center justify-between px-4"
          onClick={() => setIsUpgradesMenuOpen(true)}
        >
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-white bg-opacity-20 rounded-full">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Улучшения</span>
          </div>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            style={{ maxHeight: '80%' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-white">Улучшения</h2>
              <button className="text-gray-400" onClick={() => setIsUpgradesMenuOpen(false)}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 overflow-y-auto">
              {Object.keys(upgrades).map((upgrade, index) => (
                <button
                  key={index}
                  className="w-full h-[120px] bg-gray-800 rounded-lg flex flex-col items-center justify-center"
                  onClick={() => handleUpgradeClick(upgrade)}
                >
                  <div className="mb-2">
                    <img src={`/images/${upgrade}.png`} alt={upgrade} className="w-12 h-12" />
                  </div>
                  <span className="text-sm text-white">{`Улучшение ${index + 1}`}</span>
                  <span className="text-xs text-gray-300">Уровень {upgrades[upgrade] || 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedMineUpgrade && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedMineUpgrade(null)}
        >
          <div className="bg-gray-900 w-11/12 max-w-md p-6 rounded-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-center text-xl text-white mb-2">{`Улучшение ${selectedMineUpgrade}`}</h2>
            <p className="text-center text-gray-300 mb-4">Уровень: {upgrades[selectedMineUpgrade] || 1}</p>
            <p className="text-center text-gray-400 mb-4">
              Описание улучшения. Это улучшение поможет вам увеличить производительность и заработать больше монет.
            </p>
            {upgrades[selectedMineUpgrade] === 10 ? (
              <p className="text-center text-yellow-400 mb-4">Максимальный уровень</p>
            ) : (
              <>
                <button className="w-full py-3 bg-yellow-500 text-black rounded-lg" onClick={handleUpgrade}>
                  Улучшить ({upgradeLevels[selectedMineUpgrade as keyof typeof upgradeLevels][upgrades[selectedMineUpgrade]].cost} монет)
                </button>
              </>
            )}
            <button className="w-full py-2 mt-2 bg-gray-700 text-white rounded-lg" onClick={() => setSelectedMineUpgrade(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MineContent;
