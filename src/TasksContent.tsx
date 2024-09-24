// src/TasksContent.tsx

import React, { useEffect, useState } from 'react';
import { FaTasks } from 'react-icons/fa';
import './TasksContent.css';
import { toast } from 'react-toastify';

interface TasksContentProps {
  points: number;
  setPoints: React.Dispatch<React.SetStateAction<number>>;
  userId: number | null;
  username: string | null;
}

interface Reward {
  day: number;
  reward: number;
  collected: boolean;
  canCollect: boolean;
}

interface Task {
  id: number;
  description: string;
  reward: number;
  collected: boolean;
  canCollect: boolean;
}

const TasksContent: React.FC<TasksContentProps> = ({ setPoints, userId, username }) => {
  const [dailyRewards, setDailyRewards] = useState<Reward[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (userId !== null) {
      // Получаем данные ежедневных наград
      fetch(`/tasks?userId=${userId}`)
        .then((response) => response.json())
        .then((data) => {
          const initialRewards: Reward[] = [];
          for (let i = 1; i <= 7; i++) {
            initialRewards.push({
              day: i,
              reward: getRewardByDay(i),
              collected: i < data.currentDay,
              canCollect: i === data.currentDay && data.canCollect,
            });
          }
          setDailyRewards(initialRewards);
        })
        .catch((error) => {
          console.error('Ошибка при загрузке ежедневных наград:', error);
          toast.error('Не удалось загрузить ежедневные награды. Попробуйте позже.');
        });

      // Получаем данные заданий
      fetch(`/user-tasks?userId=${userId}`)
        .then((response) => response.json())
        .then((data) => {
          setTasks(data.tasks);
        })
        .catch((error) => {
          console.error('Ошибка при загрузке заданий:', error);
          toast.error('Не удалось загрузить задания. Попробуйте позже.');
        });
    }
  }, [userId]);

  const getRewardByDay = (day: number) => {
    switch (day) {
      case 1:
        return 10000;
      case 2:
        return 15000;
      case 3:
        return 20000;
      case 4:
        return 25000;
      case 5:
        return 30000;
      case 6:
        return 35000;
      case 7:
        return 40000;
      default:
        return 0;
    }
  };

  const handleCollectReward = (day: number) => {
    if (userId === null) return;

    fetch('/collect-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, day }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setPoints(data.newPoints);
          setDailyRewards((prevRewards) =>
            prevRewards.map((reward) =>
              reward.day === day
                ? { ...reward, collected: true, canCollect: false }
                : reward
            )
          );
          toast.success(`Награда за день ${day} успешно получена!`);
        } else {
          toast.error(data.error || 'Ошибка при сборе награды.');
        }
      })
      .catch((error) => {
        console.error('Ошибка при сборе награды:', error);
        toast.error('Не удалось собрать награду. Попробуйте позже.');
      });
  };

  const handleCollectTask = (taskId: number) => {
    if (userId === null) return;

    fetch('/collect-user-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setPoints(data.newPoints);
          setTasks((prevTasks) =>
            prevTasks.map((task) =>
              task.id === taskId
                ? { ...task, collected: true, canCollect: false }
                : task
            )
          );
          toast.success(`Награда за задание "${data.taskDescription}" успешно получена!`);
        } else {
          toast.error(data.error || 'Ошибка при сборе награды за задание.');
        }
      })
      .catch((error) => {
        console.error('Ошибка при сборе награды за задание:', error);
        toast.error('Не удалось собрать награду. Попробуйте позже.');
      });
  };

  const renderDailyRewardsList = () => (
    <div className="tasks-menu">
      <h2 className="text-center text-2xl text-white mb-4">Ежедневные награды</h2>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {dailyRewards.map((reward) => (
          <div
            key={reward.day}
            className="flex justify-between items-center bg-gray-700 p-2 rounded-lg shadow-md"
          >
            <div>
              <h3 className="text-base text-yellow-400">День {reward.day}</h3>
              <p className="text-xs text-gray-300">
                Награда: {reward.reward.toLocaleString()} монет
              </p>
            </div>
            <button
              onClick={() => handleCollectReward(reward.day)}
              className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                reward.canCollect
                  ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-600'
                  : reward.collected
                  ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed'
              }`}
              disabled={!reward.canCollect}
            >
              {reward.collected ? 'Собрано' : 'Забрать'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="px-4 z-10 pt-4">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-gray-800">
            <FaTasks size={24} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-sm text-gray-300">{username ? username : 'Гость'}</p>
          </div>
        </div>
      </div>
      {/* Блок с ежедневными наградами */}
      <div className="px-4 mt-4">
        <div
          className="w-full bg-gradient-to-r from-purple-600 to-blue-500 p-4 rounded-lg shadow-lg cursor-pointer flex items-center"
          onClick={() => setIsMenuOpen(true)}
        >
          <FaTasks size={36} className="text-white mr-4" />
          <div>
            <h2 className="text-xl font-bold text-white">Ежедневные награды</h2>
            <p className="text-white mt-1 text-sm">
              Заходи каждый день и получай награды!
            </p>
          </div>
        </div>
      </div>
      {/* Список заданий */}
      <div className="px-4 mt-6">
        <h2 className="text-xl font-bold text-white mb-4">Задания</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex justify-between items-center bg-gray-700 p-2 rounded-lg shadow-md"
            >
              <div>
                <h3 className="text-base text-yellow-400">{task.description}</h3>
                <p className="text-xs text-gray-300">
                  Награда: {task.reward.toLocaleString()} монет
                </p>
              </div>
              <button
                onClick={() => handleCollectTask(task.id)}
                className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                  task.canCollect
                    ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-600'
                    : task.collected
                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
                disabled={!task.canCollect}
              >
                {task.collected ? 'Собрано' : 'Забрать'}
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Меню с ежедневными наградами */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="bg-gray-800 w-full max-w-md p-4 rounded-t-lg animate-slide-up overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '80vh' }}
          >
            {renderDailyRewardsList()}
          </div>
        </div>
      )}
    </>
  );
};

export default TasksContent;
