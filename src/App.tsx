// src/App.tsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './App.css';
import Hamster from './icons/Hamster';
import { dollarCoin } from './images';
import Mine from './icons/Mine';
import Friends from './icons/Friends';
import MineContent from './MineContent';
import TasksContent from './TasksContent';
import FriendsContent from './FriendsContent';
import { FaTasks } from 'react-icons/fa';
import WebApp from '@twa-dev/sdk';
import LoadingScreen from './LoadingScreen';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Farm: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M1 22h22V8l-11-6-11 6v14zm2-2v-9h18v9H3zm9-4.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
  </svg>
);

// Базовое время восстановления одного клика (в миллисекундах)
const BASE_RECOVERY_RATE = 1000; 
// Базовое количество восстанавливаемых кликов за интервал

const App: React.FC = () => {
  const [tapProfit, setTapProfit] = useState(1);
  const [tapProfitLevel, setTapProfitLevel] = useState<number>(() => {
    const savedLevel = localStorage.getItem('tapProfitLevel');
    return savedLevel ? parseInt(savedLevel) : 1;
  });
  const [maxClicks, setMaxClicks] = useState<number>(() => {
    const savedMaxClicks = localStorage.getItem('maxClicks');
    return savedMaxClicks ? parseInt(savedMaxClicks) : 1000;
  });
  const [tapIncreaseLevel, setTapIncreaseLevel] = useState<number>(() => {
    const savedLevel = localStorage.getItem('tapIncreaseLevel');
    return savedLevel ? parseInt(savedLevel) : 1;
  });
  const [clickRecoveryLevel, setClickRecoveryLevel] = useState<number>(() => {
    const savedLevel = localStorage.getItem('clickRecoveryLevel');
    return savedLevel ? parseInt(savedLevel) : 1;
  });
  const [remainingClicks, setRemainingClicks] = useState<number>(maxClicks);
  const lastClickUpdateTimeRef = useRef<number>(Date.now());
  const [points, setPoints] = useState<number>(() => {
    const savedPoints = localStorage.getItem('points');
    return savedPoints ? parseInt(savedPoints) : 0;
  });
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // Новое состояние для аватарки
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Новые состояния для заданий и друзей
  const [tasks, setTasks] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);

  // Состояния для улучшений из MineContent
  const [upgrades, setUpgrades] = useState<{ [key: string]: number }>({
    upgrade1: 1,
    upgrade2: 1,
    upgrade3: 1,
    upgrade4: 1,
    upgrade5: 1,
    upgrade6: 1,
    upgrade7: 1,
    upgrade8: 1,
  });
  const [farmLevel, setFarmLevel] = useState<number>(1);
  const [incomePerHour, setIncomePerHour] = useState<number>(() => {
    const savedIncome = localStorage.getItem('incomePerHour');
    return savedIncome ? parseFloat(savedIncome) : 0;
  });

  const [clicks, setClicks] = useState<{ id: number; x: number; y: number; profit: number }[]>([]);
  const [isBoostMenuOpen, setIsBoostMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('farm');
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);

  const tapProfitLevels = useMemo(
    () => [
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
    ],
    []
  );

  const tapIncreaseLevels = useMemo(
    () => [
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
    ],
    []
  );

  // Новые уровни для Click Recovery
  const clickRecoveryLevels = useMemo(
    () => [
      { level: 1, recoveryAmount: 1, cost: 10000 },
      { level: 2, recoveryAmount: 2, cost: 20000 },
      { level: 3, recoveryAmount: 3, cost: 30000 },
      { level: 4, recoveryAmount: 4, cost: 40000 },
      { level: 5, recoveryAmount: 5, cost: 50000 },
      { level: 6, recoveryAmount: 6, cost: 60000 },
      { level: 7, recoveryAmount: 7, cost: 70000 },
      { level: 8, recoveryAmount: 8, cost: 80000 },
      { level: 9, recoveryAmount: 9, cost: 90000 },
      { level: 10, recoveryAmount: 10, cost: 100000 },
    ],
    []
  );

  const levelNames = useMemo(
    () => [
      'Beginner',
      'Intermediate',
      'Advanced',
      'Expert',
      'Master',
      'Grandmaster',
      'Champion',
      'Hero',
      'Legend',
      'Mythic',
    ],
    []
  );

  const levelMinPoints = useMemo(
    () => [0, 5000, 25000, 100000, 1000000, 2000000, 10000000, 50000000, 100000000, 1000000000],
    []
  );

  const [levelIndex, setLevelIndex] = useState(0);

  // Добавляем состояние для анимации кнопки
  const [isButtonAnimating, setIsButtonAnimating] = useState(false);

  // Функция для обновления remainingClicks на сервере
  const updateRemainingClicks = useCallback(
    async (newRemainingClicks: number) => {
      setRemainingClicks(newRemainingClicks);

      if (userId !== null) {
        try {
          const response = await fetch('/save-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              remainingClicks: newRemainingClicks,
            }),
          });

          if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
          }

          const result = await response.json();
          if (result.success) {
            console.log('Клики успешно обновлены на сервере.');
          } else {
            console.error('Ошибка при обновлении кликов на сервере:', result.error);
          }
        } catch (error) {
          console.error('Ошибка при обновлении кликов:', error);
        }
      }
    },
    [userId]
  );

  // При загрузке приложения
  useEffect(() => {
    const initData = WebApp.initDataUnsafe;
    const userIdFromTelegram = initData?.user?.id;

    if (!userIdFromTelegram) {
      setLoading(false); // Если нет userId, прекращаем загрузку
      return;
    }

    setUserId(userIdFromTelegram);

    // Получаем имя и аватарку пользователя из Telegram Web App
    const firstName = initData.user?.first_name || '';
    const lastName = initData.user?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    setUsername(fullName);

    const photoUrl = initData.user?.photo_url || null;
    setAvatarUrl(photoUrl);

    const fetchData = async () => {
      try {
        const response = await fetch(`/app?userId=${userIdFromTelegram}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Убираем установку username из данных сервера
        // if (data.username) {
        //   setUsername(data.username);
        // }
        if (data.points !== undefined) {
          setPoints(data.points);
          localStorage.setItem('points', data.points.toString());
        }
        if (data.tapProfitLevel !== undefined) {
          setTapProfitLevel(data.tapProfitLevel);
          setTapProfit(tapProfitLevels[data.tapProfitLevel - 1].profit);
          localStorage.setItem('tapProfitLevel', data.tapProfitLevel.toString());
        }
        if (data.tapIncreaseLevel !== undefined) {
          setTapIncreaseLevel(data.tapIncreaseLevel);
          setMaxClicks(tapIncreaseLevels[data.tapIncreaseLevel - 1].taps);
          localStorage.setItem('tapIncreaseLevel', data.tapIncreaseLevel.toString());
          localStorage.setItem('maxClicks', tapIncreaseLevels[data.tapIncreaseLevel - 1].taps.toString());
        }
        if (data.clickRecoveryLevel !== undefined) {
          setClickRecoveryLevel(data.clickRecoveryLevel);
          localStorage.setItem('clickRecoveryLevel', data.clickRecoveryLevel.toString());
        }
        if (data.remainingClicks !== undefined) {
          // Получаем farmExitTime с сервера и рассчитываем восстановленные клики
          if (data.farmExitTime) {
            const farmExitTime = new Date(data.farmExitTime).getTime();
            const now = Date.now();
            const elapsedTime = now - farmExitTime;

            // Используем текущий уровень восстановления
            const currentRecoveryAmount = clickRecoveryLevels[clickRecoveryLevel - 1].recoveryAmount;
            const recoveredClicks = Math.floor(elapsedTime / BASE_RECOVERY_RATE) * currentRecoveryAmount;
            const newRemainingClicks = Math.min(data.remainingClicks + recoveredClicks, maxClicks);

            setRemainingClicks(newRemainingClicks);

            // Обновляем время последнего обновления кликов
            lastClickUpdateTimeRef.current = now;

            // Обновляем remainingClicks на сервере
            await updateRemainingClicks(newRemainingClicks);
          } else {
            // Если farmExitTime отсутствует, просто используем remainingClicks из данных
            setRemainingClicks(data.remainingClicks);
          }
        }
        if (data.incomePerHour !== undefined) {
          setIncomePerHour(data.incomePerHour);
          localStorage.setItem('incomePerHour', data.incomePerHour.toString());
        }
        // Загружаем улучшения из MineContent
        setUpgrades({
          upgrade1: data.upgrade1 || 1,
          upgrade2: data.upgrade2 || 1,
          upgrade3: data.upgrade3 || 1,
          upgrade4: data.upgrade4 || 1,
          upgrade5: data.upgrade5 || 1,
          upgrade6: data.upgrade6 || 1,
          upgrade7: data.upgrade7 || 1,
          upgrade8: data.upgrade8 || 1,
        });
        setFarmLevel(data.farmLevel || 1);

        // Загружаем задания и друзей при запуске приложения
        await Promise.all([fetchTasks(userIdFromTelegram), fetchFriends(userIdFromTelegram)]);
      } catch (error) {
        console.error('Ошибка при загрузке данных с сервера:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tapProfitLevels, tapIncreaseLevels, updateRemainingClicks, maxClicks, clickRecoveryLevel, clickRecoveryLevels]);

  // Обновление remainingClicks каждую секунду
  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      setRemainingClicks((prevClicks: number) => {
        const currentRecoveryAmount = clickRecoveryLevels[clickRecoveryLevel - 1].recoveryAmount;
        const newClicks = Math.min(prevClicks + currentRecoveryAmount, maxClicks);
        if (newClicks !== prevClicks) {
          lastClickUpdateTimeRef.current = Date.now();

          // Сохраняем новое значение на сервере
          updateRemainingClicks(newClicks);
        }
        return newClicks;
      });
    }, BASE_RECOVERY_RATE);

    return () => clearInterval(recoveryInterval);
  }, [maxClicks, updateRemainingClicks, clickRecoveryLevel, clickRecoveryLevels]);

  // Обновляем farmExitTime на сервере при выходе из "Farm"
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (userId !== null && currentPage === 'farm') {
        const exitTime = new Date().toISOString();
        navigator.sendBeacon('/save-entry-exit-time', JSON.stringify({
          userId,
          action: 'exit_farm',
          time: exitTime,
        }));
      }
      if (userId !== null) {
        fetch('/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            remainingClicks,
            points,
            lastLogout: new Date().toISOString(),
          }),
        }).catch((error) => console.error('Ошибка при отправке времени выхода:', error));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (userId !== null && currentPage === 'farm') {
        const exitTime = new Date().toISOString();
        fetch('/save-entry-exit-time', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            action: 'exit_farm',
            time: exitTime,
          }),
        }).catch((error) => console.error('Ошибка при сохранении времени выхода из farm:', error));
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, remainingClicks, points, currentPage]);

  const previousPageRef = useRef<string>(currentPage);

  useEffect(() => {
    if (userId !== null) {
      if (currentPage === 'mine' && previousPageRef.current !== 'mine') {
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
        }).catch((error) => console.error('Ошибка при сохранении времени входа в mine:', error));
      } else if (currentPage !== 'mine' && previousPageRef.current === 'mine') {
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
        }).catch((error) => console.error('Ошибка при сохранении времени выхода из mine:', error));
      }

      if (currentPage === 'farm' && previousPageRef.current !== 'farm') {
        fetch('/save-entry-exit-time', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            action: 'enter_farm',
            time: new Date().toISOString(),
          }),
        }).catch((error) => console.error('Ошибка при сохранении времени входа в farm:', error));
      } else if (currentPage !== 'farm' && previousPageRef.current === 'farm') {
        const exitTime = new Date().toISOString();
        fetch('/save-entry-exit-time', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            action: 'exit_farm',
            time: exitTime,
          }),
        }).catch((error) => console.error('Ошибка при сохранении времени выхода из farm:', error));
      }

      previousPageRef.current = currentPage;
    }
  }, [currentPage, userId]);

  // Функции для загрузки заданий и друзей
  const fetchTasks = useCallback(
    async (userIdParam: number | null = null) => {
      const uid = userIdParam || userId;
      if (uid !== null) {
        try {
          const response = await fetch(`/user-tasks?userId=${uid}`);
          const data = await response.json();
          if (data && data.tasks) {
            setTasks(data.tasks);
          } else {
            setTasks([]);
          }
        } catch (error) {
          console.error('Ошибка при загрузке заданий:', error);
          setTasks([]);
        }
      }
    },
    [userId]
  );

  const fetchFriends = useCallback(
    async (userIdParam: number | null = null) => {
      const uid = userIdParam || userId;
      if (uid !== null) {
        try {
          const response = await fetch(`/invited-friends?userId=${uid}`);
          const data = await response.json();
          if (data && data.friends) {
            setFriends(data.friends);
          } else {
            setFriends([]);
          }
        } catch (error) {
          console.error('Ошибка при загрузке списка друзей:', error);
          setFriends([]);
        }
      }
    },
    [userId]
  );

  const handleMainButtonClick = useCallback(
    async (e: React.TouchEvent<HTMLDivElement>) => {
      const touches = e.touches;
      if (remainingClicks > 0 && touches.length <= 5) {
        const newRemainingClicks = remainingClicks - touches.length;
        updateRemainingClicks(newRemainingClicks);

        // Обновляем время последнего обновления кликов
        lastClickUpdateTimeRef.current = Date.now();

        const newPoints = points + tapProfit * touches.length;
        setPoints(newPoints);

        localStorage.setItem('points', newPoints.toString());

        if (userId !== null) {
          try {
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
                clickRecoveryLevel,
                remainingClicks: newRemainingClicks,
                ...upgrades,
                farmLevel,
                incomePerHour,
              }),
            });
          } catch (error) {
            console.error('Ошибка при сохранении данных:', error);
          }
        }

        const newClicks = Array.from(touches).map((touch) => ({
          id: Date.now() + touch.identifier,
          x: touch.clientX,
          y: touch.clientY,
          profit: tapProfit,
        }));

        setClicks((prevClicks) => [...prevClicks, ...newClicks]);

        setTimeout(() => {
          setClicks((prevClicks) =>
            prevClicks.filter((click) => !newClicks.some((newClick) => newClick.id === click.id))
          );
        }, 1000);

        // Запускаем анимацию
        setIsButtonAnimating(true);
        setTimeout(() => {
          setIsButtonAnimating(false);
        }, 200); // 0.2 секунды
      }
    },
    [
      remainingClicks,
      tapProfit,
      points,
      userId,
      tapProfitLevel,
      tapIncreaseLevel,
      clickRecoveryLevel,
      upgrades,
      farmLevel,
      updateRemainingClicks,
      incomePerHour,
    ]
  );
  
  // Обновите путь к изображению

  const saveUpgradeData = useCallback(
    async (newTapProfitLevel: number, newTapIncreaseLevel: number, newClickRecoveryLevel: number) => {
      if (userId !== null) {
        try {
          const response = await fetch('/save-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId,
              points,
              tapProfitLevel: newTapProfitLevel,
              tapIncreaseLevel: newTapIncreaseLevel,
              clickRecoveryLevel: newClickRecoveryLevel,
              remainingClicks,
              ...upgrades,
              farmLevel,
              incomePerHour,
            }),
          });

          if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
          }

          const result = await response.json();
          if (result.success) {
            console.log('Данные успешно сохранены на сервере.');
            setTapProfitLevel(result.tapProfitLevel);
            setTapIncreaseLevel(result.tapIncreaseLevel);
            setClickRecoveryLevel(result.clickRecoveryLevel);

            // Сохранение в localStorage
            localStorage.setItem('tapProfitLevel', result.tapProfitLevel.toString());
            localStorage.setItem('tapIncreaseLevel', result.tapIncreaseLevel.toString());
            localStorage.setItem('clickRecoveryLevel', result.clickRecoveryLevel.toString());
            setMaxClicks(tapIncreaseLevels[result.tapIncreaseLevel - 1].taps);
            localStorage.setItem(
              'maxClicks',
              tapIncreaseLevels[result.tapIncreaseLevel - 1].taps.toString()
            );
          } else {
            console.error('Ошибка при сохранении данных на сервере:', result.error);
          }
        } catch (error) {
          console.error('Ошибка при сохранении данных:', error);
        }
      } else {
        console.log('userId равен null, запрос POST не отправлен');
      }
    },
    [userId, points, remainingClicks, upgrades, farmLevel, tapIncreaseLevels, incomePerHour]
  );

  const upgradeTapProfit = async () => {
    const nextLevelData = tapProfitLevels[tapProfitLevel];
    if (nextLevelData && points >= nextLevelData.cost) {
      const newLevel = tapProfitLevel + 1;

      setPoints((prevPoints) => prevPoints - nextLevelData.cost);
      setTapProfitLevel(newLevel);
      setTapProfit(tapProfitLevels[newLevel - 1].profit);
      localStorage.setItem('tapProfitLevel', newLevel.toString());

      await saveUpgradeData(newLevel, tapIncreaseLevel, clickRecoveryLevel);
    } else {
      toast.error('Недостаточно монет для улучшения.');
    }
  };

  const upgradeTapIncrease = async () => {
    const nextLevelData = tapIncreaseLevels[tapIncreaseLevel];
    if (nextLevelData && points >= nextLevelData.cost) {
      const newLevel = tapIncreaseLevel + 1;

      setPoints((prevPoints) => prevPoints - nextLevelData.cost);
      setTapIncreaseLevel(newLevel);
      setMaxClicks(tapIncreaseLevels[newLevel - 1].taps);
      localStorage.setItem('tapIncreaseLevel', newLevel.toString());
      localStorage.setItem('maxClicks', tapIncreaseLevels[newLevel - 1].taps.toString());

      await saveUpgradeData(tapProfitLevel, newLevel, clickRecoveryLevel);
    } else {
      toast.error('Недостаточно монет для улучшения.');
    }
  };

  const upgradeClickRecovery = async () => {
    const nextLevelData = clickRecoveryLevels[clickRecoveryLevel];
    if (nextLevelData && points >= nextLevelData.cost) {
      const newLevel = clickRecoveryLevel + 1;

      setPoints((prevPoints) => prevPoints - nextLevelData.cost);
      setClickRecoveryLevel(newLevel);
      localStorage.setItem('clickRecoveryLevel', newLevel.toString());

      await saveUpgradeData(tapProfitLevel, tapIncreaseLevel, newLevel);
    } else {
      toast.error('Недостаточно монет для улучшения.');
    }
  };

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

  const renderUpgradeOption = (type: 'multitap' | 'tapIncrease' | 'clickRecovery') => {
    const isMultitap = type === 'multitap';
    const isTapIncrease = type === 'tapIncrease';
    const isClickRecovery = type === 'clickRecovery';
  
    const currentLevel = isMultitap
      ? tapProfitLevel
      : isTapIncrease
      ? tapIncreaseLevel
      : isClickRecovery
      ? clickRecoveryLevel
      : 1;
  
    const description = isMultitap
      ? 'Увеличивает прибыль за каждый тап, позволяя быстрее копить монеты.'
      : isTapIncrease
      ? 'Увеличивает максимальное количество доступных кликов.'
      : isClickRecovery
      ? 'Увеличивает скорость восстановления кликов, позволяя быстрее восстанавливать энергию.'
      : '';

    return (
      <button
        key={type}
        className="w-full h-24 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg shadow-lg overflow-hidden relative mt-4"
        onClick={() => setSelectedUpgrade(type)}
      >
        <div className="absolute top-0 left-0 w-full h-full bg-yellow-400 opacity-10"></div>
        <div className="flex flex-col justify-between h-full p-4">
          <div className="flex justify-between items-start">
            <span className="text-lg font-semibold text-gray-300">
              {isMultitap ? 'Multitap' : isTapIncrease ? 'Tap Increase' : 'Click Recovery'}
            </span>
            <span className="text-xs font-medium text-yellow-400 bg-gray-800 px-2 py-1 rounded-full">
              Level {currentLevel}
            </span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-sm text-gray-400">{description}</span>
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
    );
  };

  const renderUpgradeMenu = () => {
    const isMultitap = selectedUpgrade === 'multitap';
    const isTapIncrease = selectedUpgrade === 'tapIncrease';
    const isClickRecovery = selectedUpgrade === 'clickRecovery';

    const currentLevel = isMultitap
    ? tapProfitLevel
    : isTapIncrease
    ? tapIncreaseLevel
    : isClickRecovery
    ? clickRecoveryLevel
    : 1;

    const maxLevel = 10;

    const description = isMultitap
      ? 'Увеличивает прибыль за каждый тап, позволяя вам быстрее накапливать монеты. Это улучшение поможет вам быстрее достигать новых уровней и зарабатывать больше очков.'
      : isTapIncrease
      ? 'Увеличивает максимальное количество доступных кликов. Это улучшение позволит вам играть дольше без необходимости ждать восстановления кликов.'
      : 'Увеличивает скорость восстановления кликов, позволяя вам быстрее восстанавливать энергию и продолжать игру без задержек.';

    const upgradeFunction = isMultitap
      ? upgradeTapProfit
      : isTapIncrease
      ? upgradeTapIncrease
      : upgradeClickRecovery;

    const levelsData = isMultitap
      ? tapProfitLevels
      : isTapIncrease
      ? tapIncreaseLevels
      : clickRecoveryLevels;

    const nextLevelData = levelsData[currentLevel];

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
        onClick={() => setSelectedUpgrade(null)}
      >
        <div
          className="bg-gray-800 w-full max-w-md p-6 rounded-t-lg animate-slide-up overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: '90vh' }} // Ограничиваем высоту для прокрутки
        >
          <h2 className="text-center text-xl text-white mb-4">
            {isMultitap ? 'Multitap' : isTapIncrease ? 'Tap Increase' : 'Click Recovery'}
          </h2>
          <p className="text-center text-gray-400 mb-4">{description}</p>
          <p className="text-center text-gray-300 mb-4">Текущий уровень: {currentLevel}</p>
          {currentLevel < maxLevel && (
            <button
              onClick={upgradeFunction}
              disabled={points < nextLevelData.cost}
              className={`w-full py-3 bg-yellow-500 text-black rounded-lg ${
                points >= nextLevelData.cost
                  ? 'hover:bg-yellow-600'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              Улучшить за {nextLevelData.cost} монет
            </button>
          )}
          {currentLevel >= maxLevel && (
            <p className="text-center text-yellow-400 mt-4">Максимальный уровень достигнут</p>
          )}
          <button
            className="w-full py-2 mt-4 bg-gray-700 text-white rounded-lg"
            onClick={() => setSelectedUpgrade(null)}
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  };

  const renderUserInfo = () => (
    <div className="px-4 z-10 pt-4">
      <div className="flex items-center space-x-2">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="p-1 rounded-lg bg-gray-800">
            <Hamster size={24} className="text-yellow-400" />
          </div>
        )}
        <div>
          <p className="text-sm text-gray-300">{username ? username : 'Гость'}</p>
        </div>
      </div>
      <div className="flex items-center justify-between space-x-4 mt-1">
        <div className="flex items-center w-full">
          <div className="w-full">
            <div className="flex justify-between">
              <p className="text-sm text-gray-300">{levelNames[levelIndex]}</p>
              <p className="text-sm text-gray-300">
                {levelIndex + 1} <span className="text-yellow-400">/ {levelNames.length}</span>
              </p>
            </div>
            <div className="flex items-center mt-1 border-2 border-gray-600 rounded-full">
              <div className="w-full h-2 bg-gray-700 rounded-full">
                <div
                  className="h-2 rounded-full bg-yellow-400 transition-all duration-200 ease-linear"
                  style={{ width: `${calculateProgress}%` }}
                ></div>
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
            className={`w-80 h-80 p-4 rounded-full bg-gray-700 shadow-lg main-button ${isButtonAnimating ? 'animating' : ''}`}
            onTouchStart={handleMainButtonClick}
          >

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
          <div className="w-[calc(100%-50px)] h-[10px] bg-gray-600 rounded-md overflow-hidden relative">
            <div
              className="h-full bg-yellow-400 transition-all duration-200 ease-linear"
              style={{ width: `${(remainingClicks / maxClicks) * 100}%` }}
            ></div>
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pr-2 text-sm text-gray-300">
              {remainingClicks} / {maxClicks}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderTasksContent = () => (
    <TasksContent
      points={points}
      setPoints={setPoints}
      userId={userId}
      username={username}
      tasks={tasks}
      fetchTasks={fetchTasks}
    />
  );

  const renderFriendsContent = () => (
    <FriendsContent
      username={username || 'Гость'}
      userId={userId}
      friends={friends}
      fetchFriends={fetchFriends}
    />
  );

  const renderBoostContent = () => (
    <>
      {renderUserInfo()}
      <div className="px-4 mt-4">
        <div className="h-px bg-gray-600 my-4"></div>
        {renderUpgradeOption('multitap')}
        {renderUpgradeOption('tapIncrease')}
        {renderUpgradeOption('clickRecovery')}
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-900">
      <ToastContainer />
      {loading ? (
        <LoadingScreen />
      ) : (
        <div className="w-full max-w-[390px] h-screen font-bold flex flex-col relative overflow-hidden bg-gray-800">
          {currentPage === 'farm' && !isBoostMenuOpen && renderMainContent()}
          {currentPage === 'mine' && (
            <MineContent
              points={points}
              setPoints={setPoints}
              username={username || 'Гость'}
              userId={userId}
              tapProfitLevel={tapProfitLevel}
              tapIncreaseLevel={tapIncreaseLevel}
              remainingClicks={remainingClicks}
              upgrades={upgrades}
              setUpgrades={setUpgrades}
              farmLevel={farmLevel}
              setFarmLevel={setFarmLevel}
              incomePerHour={incomePerHour}
              setIncomePerHour={setIncomePerHour}
            />
          )}
          {currentPage === 'tasks' && renderTasksContent()}
          {currentPage === 'friends' && renderFriendsContent()}
          {isBoostMenuOpen && renderBoostContent()}
          {selectedUpgrade && renderUpgradeMenu()}

          {/* Навигационная панель */}
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
            <button
              className={`text-center flex flex-col items-center relative ${
                currentPage === 'tasks' ? 'text-yellow-400' : 'text-gray-300'
              }`}
              onClick={() => {
                setCurrentPage('tasks');
                setIsBoostMenuOpen(false);
              }}
            >
              <FaTasks className="w-6 h-6 mb-1" />
              Tasks
              {currentPage === 'tasks' && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full"></div>
              )}
            </button>
            <button
              className={`text-center flex flex-col items-center relative ${
                currentPage === 'friends' ? 'text-yellow-400' : 'text-gray-300'
              }`}
              onClick={() => {
                setCurrentPage('friends');
                setIsBoostMenuOpen(false);
              }}
            >
              <Friends className="w-6 h-6 mb-1" />
              Friends
              {currentPage === 'friends' && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-yellow-400 rounded-full"></div>
              )}
            </button>
          </div>

          {clicks.map((click) => (
            <div key={click.id} className="clicked-number" style={{ top: click.y, left: click.x }}>
              +{click.profit}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
