import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import Hamster from './icons/Hamster';
import { dollarCoin } from './images';
import Mine from './icons/Mine';
import Friends from './icons/Friends';
import MineContent from './MineContent'; // Adjust the path as necessary
import { FaTasks } from 'react-icons/fa'; // Импортируем иконку задач
import axios from 'axios';

const Farm: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M1 22h22V8l-11-6-11 6v14zm2-2v-9h18v9H3zm9-4.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
  </svg>
);

const RECOVERY_RATE = 1000; // 1 клик в секунду (1000 мс)

const App: React.FC = () => {
  const [tapProfit, setTapProfit] = useState(1);
  const [tapProfitLevel, setTapProfitLevel] = useState(1);
  const [maxClicks, setMaxClicks] = useState(1000);
  const [tapIncreaseLevel, setTapIncreaseLevel] = useState(1);
  const [remainingClicks, setRemainingClicks] = useState(maxClicks);
  const [points, setPoints] = useState(100000000);
  const [username, setUsername] = useState<string | null>(null);

  const [clicks, setClicks] = useState<{ id: number, x: number, y: number, profit: number }[]>([]);
  const [isBoostMenuOpen, setIsBoostMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('farm');
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);

  const tapProfitLevels = useMemo(() => [
    { level: 1, profit: 1, cost: 1000 },
    { level: 2, profit: 2, cost: 2000 },
    { level: 3, profit: 4, cost: 4000 },
    { level: 4, profit: 6, cost: 8000 },
    { level: 5, profit: 8, cost: 16000 },
    { level: 6, profit: 10, cost: 24000 },
    { level: 7, profit: 12, cost: 48000 },
    { level: 8, profit: 14, cost: 72000 },
    { level: 9, profit: 16, cost: 104000 },
    { level: 10, profit: 18, cost: 178000 },
  ], []);

  const levelNames = useMemo(() => [
    "Beginner", "Intermediate", "Advanced", "Expert", "Master",
    "Grandmaster", "Champion", "Hero", "Legend", "Mythic"
  ], []);

  const levelMinPoints = useMemo(() => [
    0, 5000, 25000, 100000, 1000000,
    2000000, 10000000, 50000000, 100000000, 1000000000
  ], []);

  const [levelIndex, setLevelIndex] = useState(0);

  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      setRemainingClicks((prevClicks: number) => Math.min(prevClicks + 1, maxClicks));
    }, RECOVERY_RATE);

    return () => clearInterval(recoveryInterval);
  }, [maxClicks]);



  useEffect(() => {
    if (window.Telegram?.WebApp) {
        const telegramUser = window.Telegram.WebApp.initDataUnsafe?.user;
        console.log("Telegram WebApp Data:", window.Telegram.WebApp.initDataUnsafe); // Отладка данных WebApp

        if (telegramUser?.username) {
            const username = telegramUser.username;

            axios.post('/api/user', { username })
                .then(() => {
                    return axios.get(`/api/user/current?username=${username}`);
                })
                .then(response => {
                    const { username } = response.data;
                    console.log("Username received from server:", username);
                    setUsername(username);
                })
                .catch(error => {
                    console.error('Error loading or saving user data:', error);
                });
        } else {
            console.error('No username available in Telegram WebApp context');
        }
    } else {
        console.error('Telegram WebApp context is not available');
    }
}, []);




  const handleMainButtonClick = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touches = e.touches;
    if (remainingClicks > 0 && touches.length <= 5) {
      setRemainingClicks((prevClicks: number) => prevClicks - touches.length);
      setPoints(prevPoints => prevPoints + tapProfit * touches.length);

      const newClicks = Array.from(touches).map(touch => ({
        id: Date.now() + touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        profit: tapProfit
      }));

      setClicks(prevClicks => [...prevClicks, ...newClicks]);

      setTimeout(() => {
        setClicks(prevClicks => prevClicks.filter(click => !newClicks.some(newClick => newClick.id === click.id)));
      }, 1000);

      // Добавляем класс анимации
      const button = e.currentTarget;
      button.classList.add('clicked');
      setTimeout(() => {
        button.classList.remove('clicked');
      }, 200); // Убираем класс через 200 мс
    }
  }, [remainingClicks, tapProfit]);

  const calculateProgress = useMemo(() => {
    if (levelIndex >= levelNames.length - 1) {
      return 100;
    }
    const currentLevelMin = levelMinPoints[levelIndex];
    const nextLevelMin = levelMinPoints[levelIndex + 1];
    const progress = ((points - currentLevelMin) / (nextLevelMin - currentLevelMin)) * 100;
    return Math.min(progress, 100);
  }, [points, levelIndex, levelMinPoints, levelNames.length]);

  useEffect(() => {
    const currentLevelMin = levelMinPoints[levelIndex];
    const nextLevelMin = levelMinPoints[levelIndex + 1];
    if (points >= nextLevelMin && levelIndex < levelNames.length - 1) {
      setLevelIndex(levelIndex + 1);
    } else if (points < currentLevelMin && levelIndex > 0) {
      setLevelIndex(levelIndex - 1);
    }
  }, [points, levelIndex, levelMinPoints, levelNames.length]);

  const toggleBoostMenu = () => {
    setIsBoostMenuOpen(!isBoostMenuOpen);
  };

  const upgradeTapProfit = () => {
    const nextLevel = tapProfitLevels[tapProfitLevel];
    if (nextLevel && points >= nextLevel.cost) {
      setPoints(prevPoints => prevPoints - nextLevel.cost);
      setTapProfitLevel(prevLevel => prevLevel + 1);
      setTapProfit(nextLevel.profit);
    }
  };

  const tapIncreaseLevels = useMemo(() => [
    { level: 1, taps: 1000, cost: 3000 },
    { level: 2, taps: 1500, cost: 7000 },
    { level: 3, taps: 2000, cost: 11000 },
    { level: 4, taps: 2500, cost: 26000 },
    { level: 5, taps: 3000, cost: 45000 },
    { level: 6, taps: 3500, cost: 72000 },
    { level: 7, taps: 4000, cost: 120000 },
    { level: 8, taps: 4500, cost: 170000 },
    { level: 9, taps: 5000, cost: 210000 },
    { level: 10, taps: 5500, cost: 270000 },
  ], []);

  const upgradeTapIncrease = () => {
    const nextLevel = tapIncreaseLevels[tapIncreaseLevel];
    if (nextLevel && points >= nextLevel.cost) {
      setPoints(prevPoints => prevPoints - nextLevel.cost);
      setTapIncreaseLevel(prevLevel => prevLevel + 1);
      setMaxClicks(nextLevel.taps);
      setRemainingClicks(nextLevel.taps);
    }
  };

  const renderUserInfo = () => (
    <div className="px-4 z-10 pt-4">
      <div className="flex items-center space-x-2">
        <div className="p-1 rounded-lg bg-gray-800">
          <Hamster size={24} className="text-yellow-400" />
        </div>
        <div>
        <p className="text-sm text-gray-300">{username ? username : 'Гость'}</p> {/* Используем состояние username */}
        </div>
      </div>
      <div className="flex items-center justify-between space-x-4 mt-1">
        <div className="flex items-center w-full">
          <div className="w-full">
            <div className="flex justify-between">
              <p className="text-sm text-gray-300">{levelNames[levelIndex]}</p>
              <p className="text-sm text-gray-300">{levelIndex + 1} <span className="text-yellow-400">/ {levelNames.length}</span></p>
            </div>
            <div className="flex items-center mt-1 border-2 border-gray-600 rounded-full">
              <div className="w-full h-2 bg-gray-700 rounded-full">
                <div className="h-2 rounded-full bg-yellow-400" style={{ width: `${calculateProgress}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMainContent = () => (
    <>
      {renderUserInfo()}

      <div className="flex-grow mt-4 relative">
        <div className="px-4 mt-4 flex justify-center">
          <div className="px-4 py-2 flex items-center space-x-2">
            <img src={dollarCoin} alt="Dollar Coin" className="w-10 h-10" />
            <p className="text-4xl text-yellow-400">{Math.floor(points).toLocaleString()}</p>
          </div>
        </div>

        <div className="px-4 mt-4 flex justify-center">
          <div
            className="w-80 h-80 p-4 rounded-full bg-gray-700 shadow-lg main-button"
            onTouchStart={handleMainButtonClick}
          >
            <div className="w-full h-full rounded-full bg-gray-600 flex items-center justify-center">
              {/* Главная кнопка без изображения */}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-32 right-4 z-50">
        <button
          onClick={toggleBoostMenu}
          className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-full font-bold shadow-lg"
        >
          Boost
        </button>
      </div>
      <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center z-40">
        <div className="w-full px-4 flex items-center justify-between mb-4">
          <div className="w-[calc(100%-50px)] h-[10px] bg-gray-600 rounded-md overflow-hidden">
            <div 
              className="h-full bg-yellow-400 transition-all duration-200 ease-linear"
              style={{ width: `${(remainingClicks / maxClicks) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </>
  );




  const renderBoostMenu = () => {
    const closeUpgradeMenu = () => setSelectedUpgrade(null);
  
    const renderUpgradeMenu = (type: 'multitap' | 'tapIncrease') => {
      const isMultitap = type === 'multitap';
      const currentLevel = isMultitap ? tapProfitLevel : tapIncreaseLevel;
      const maxLevel = 10;
      const nextLevel = isMultitap ? tapProfitLevels[currentLevel] : tapIncreaseLevels[currentLevel];
  
      const upgradeFunction = isMultitap ? upgradeTapProfit : upgradeTapIncrease;
  
      const description = isMultitap
        ? 'Increases the profit for each tap, allowing you to accumulate coins faster. This improvement will help you reach new levels faster and earn more points.'
        : 'Increases the maximum number of taps that can be made at a time. This improvement will allow you to play longer without having to wait for clicks to be restored.';
  
      return (
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50`}
          onClick={closeUpgradeMenu}
        >
          <div className="bg-gray-800 w-full max-w-md p-9 rounded-t-lg animate-slide-up mb-0">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-10 bg-gray-600 rounded-full"></div>
            </div>
            <h2 className="text-center text-xl text-white mb-2">
              {isMultitap ? 'Multitap' : 'Tap increase'}
            </h2>
            <p className="text-center text-gray-300 mb-4">Level: {currentLevel}</p>
            <p className="text-center text-gray-400 mb-4">{description}</p>
            {currentLevel === maxLevel ? (
              <p className="text-center text-yellow-400 mb-4">Max level</p>
            ) : (
              <button
                className="w-full py-3 bg-yellow-500 text-black rounded-lg"
                onClick={upgradeFunction}
                disabled={points < nextLevel.cost}
              >
                Upgrade ({nextLevel.cost} coins)
              </button>
            )}
            <button className="w-full py-2 mt-2 bg-gray-700 text-white rounded-lg" onClick={closeUpgradeMenu}>
              Close
            </button>
          </div>
        </div>
      );
    };
  
    return (
      <div className="absolute inset-0 bg-gray-800 z-50 flex flex-col">
        {renderUserInfo()}
        <div className="w-full h-px bg-gray-600 mt-4"></div>
  
        <div className="flex-grow flex flex-col items-center justify-start p-4 space-y-5">
          <div
            className="w-full bg-gray-700 rounded-lg p-4"
            onClick={() => setSelectedUpgrade('multitap')}
          >
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-semibold">Multitap</span>
              <span className="text-yellow-400 font-bold">Level {tapProfitLevel}</span>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Increases the profit for each tap, allowing you to accumulate coins faster.
            </p>
          </div>
  
          <div
            className="w-full bg-gray-700 rounded-lg p-4"
            onClick={() => setSelectedUpgrade('tapIncrease')}
          >
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-semibold">Tap increase</span>
              <span className="text-yellow-400 font-bold">Level {tapIncreaseLevel}</span>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Increases the maximum number of taps that can be made at a time.
            </p>
          </div>
        </div>
        {selectedUpgrade && renderUpgradeMenu(selectedUpgrade as 'multitap' | 'tapIncrease')}
        {selectedUpgrade && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={closeUpgradeMenu}
          ></div>
        )}
      </div>
    );
  };
  const renderUpgradeMenu = (type: 'multitap' | 'tapIncrease') => {
    const isMultitap = type === 'multitap';
    const currentLevel = isMultitap ? tapProfitLevel : tapIncreaseLevel;
    const maxLevel = 10;
    const nextLevel = isMultitap ? tapProfitLevels[currentLevel] : tapIncreaseLevels[currentLevel];
    const upgradeFunction = isMultitap ? upgradeTapProfit : upgradeTapIncrease;

    const description = isMultitap
      ? 'Увеличивает прибыль за каждый тап, позволяя быстрее накапливать монеты. Это улучшение поможет вам быстрее достигать новых уровней и зарабатывать больше очков.'
      : 'Повышает максимальное количество тапов, которые можно сделать за один раз. Это улучшение позволит вам дольше играть без необходимости ждать восстановления кликов.';

    return (
      <div
        className={`fixed bottom-0 left-0 right-0 bg-gray-800 rounded-t-2xl p-4 z-[40] transition-transform duration-1000 ease-out ${
          selectedUpgrade ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: 'calc(50% - 80px)' }} // Adjusted height to be above the navigation bar
      >
        <div className="flex flex-col items-center">
          <div className="w-10 h-12 bg-gray-700 mb-2"></div>
          <h2 className="text-xl font-bold text-yellow-400 mb-1">
            {isMultitap ? 'Multitap' : 'Увеличение количества тапов'}
          </h2>
          <p className="text-sm text-gray-400 mb-2">Уровень {currentLevel}</p>
          <p className="text-sm text-gray-300 text-center mb-4">
            {description}
          </p>
          {currentLevel < maxLevel ? (
            <button
              onClick={upgradeFunction}
              disabled={points < nextLevel.cost}
              className={`w-full py-3 rounded-lg font-bold text-center transition-colors ${
                points >= nextLevel.cost
                  ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              Улучшить ({nextLevel.cost} монет)
            </button>
          ) : (
            <div className="text-yellow-400 font-bold text-center">MAX LEVEL</div>
          )}
        </div>
      </div>
    );
  };

  
  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-900">
      <div className="w-full max-w-[390px] h-screen font-bold flex flex-col relative overflow-hidden bg-gray-800">
        {currentPage === 'farm' && !isBoostMenuOpen && renderMainContent()}
        {currentPage === 'mine' && (
          <MineContent
            points={points}
            setPoints={setPoints}
            selectedUpgrade={selectedUpgrade}
            setSelectedUpgrade={setSelectedUpgrade}
            renderUpgradeMenu={renderUpgradeMenu}
          />
        )}
        {isBoostMenuOpen && renderBoostMenu()}

        <div className="absolute bottom-0 left-0 right-0 bg-gray-700 rounded-t-2xl flex justify-around items-center text-xs py-4 px-2 z-50">
          <button
            className={`text-center flex flex-col items-center relative ${
              currentPage === 'farm' ? 'text-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => {
              setCurrentPage('farm');
              setIsBoostMenuOpen(false);
            }}
          >
            <Farm className="w-6 h-6 mb-1" />
            Farm
            {currentPage === 'farm' && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full"></div>
            )}
          </button>
          <button
            className={`text-center flex flex-col items-center relative ${
              currentPage === 'mine' ? 'text-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => {
              setCurrentPage('mine');
              setIsBoostMenuOpen(false);
            }}
          >
            <Mine className="w-6 h-6 mb-1" />
            Mine
            {currentPage === 'mine' && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full"></div>
            )}
          </button>
          <button className="text-center text-gray-300 flex flex-col items-center">
            <Friends className="w-6 h-6 mb-1" />
            Friends
          </button>
          <div className="text-center text-gray-300 flex flex-col items-center">
            <FaTasks className="w-6 h-6 mb-1" />
            Tasks
          </div>
        </div>

        {clicks.map((click) => (
          <div
            key={click.id}
            className="clicked-number"
            style={{ top: click.y, left: click.x }}
          >
            +{click.profit}
          </div>
        ))}
      </div>
    </div>
  );



  




};




export default App;
