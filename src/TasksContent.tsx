// src/TasksContent.tsx

import React, { useEffect, useState } from 'react';
import { FaTasks } from 'react-icons/fa';
import './TasksContent.css';

interface TasksContentProps {
  points: number;
  setPoints: React.Dispatch<React.SetStateAction<number>>;
  userId: number | null;
  username: string | null; // Добавлен username
}

interface Task {
  day: number;
  reward: number;
  collected: boolean;
  canCollect: boolean;
}

const TasksContent: React.FC<TasksContentProps> = ({setPoints, userId, username }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (userId !== null) {
      fetch(`/tasks?userId=${userId}`)
        .then((response) => response.json())
        .then((data) => {
          const initialTasks: Task[] = [];
          for (let i = 1; i <= 7; i++) {
            initialTasks.push({
              day: i,
              reward: getRewardByDay(i),
              collected: data.collectedDays.includes(i),
              canCollect: i === data.currentDay && data.canCollect, // Теперь правильная проверка
            });
          }
          setTasks(initialTasks);
        })
        .catch((error) => {
          console.error('Ошибка при загрузке задач:', error);
          setNotification('Не удалось загрузить задачи. Попробуйте позже.');
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

  const handleCollect = (day: number) => {
    if (userId === null) return;

    fetch('/collect-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, day }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setPoints(data.newPoints);
          setTasks((prevTasks) =>
            prevTasks.map((task) =>
              task.day === day
                ? { ...task, collected: true }
                : task
            )
          );
          setNotification(`Награда за день ${day} успешно забрана!`);
        } else {
          setNotification(data.error || 'Ошибка при сборе награды.');
        }
      })
      .catch((error) => {
        console.error('Ошибка при сборе награды:', error);
        setNotification('Не удалось собрать награду. Попробуйте позже.');
      });
  };

  const renderTasksList = () => (
    <div className="tasks-menu">
      <h2 className="text-center text-2xl text-white mb-4">Ежедневные награды</h2>
      <div className="space-y-4">
        {tasks.map((task) => (
          <div key={task.day} className="flex justify-between items-center bg-gray-700 p-4 rounded-lg shadow-md">
            <div>
              <h3 className="text-lg text-yellow-400">День {task.day}</h3>
              <p className="text-sm text-gray-300">Награда: {task.reward.toLocaleString()} монет</p>
            </div>
            <button
              onClick={() => handleCollect(task.day)}
              className={`px-4 py-2 rounded-lg font-semibold ${
                task.collected
                  ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                  : task.canCollect
                  ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-600'
                  : 'bg-gray-500 text-gray-300 cursor-not-allowed' // Неактивная кнопка
              }`}
              disabled={task.collected || !task.canCollect}
            >
              {task.collected ? 'Собрано' : 'Забрать'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {notification}
          <button
            className="absolute top-0 right-0 mt-1 mr-2 text-white"
            onClick={() => setNotification(null)}
          >
            ✕
          </button>
        </div>
      )}
      <div className="px-4 z-10 pt-4">
        {/* Отображение имени пользователя */}
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
      <div className="px-4 mt-4 flex justify-center">
        <div
          className="w-full max-w-md p-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-xl cursor-pointer"
          onClick={() => setIsMenuOpen(true)}
        >
          <h2 className="text-2xl font-bold text-white text-center">Ежедневные награды</h2>
          <p className="text-center text-gray-200 mt-2">
            Заходи каждый день и получай награды!
          </p>
        </div>
      </div>
      {/* Меню с наградами */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="bg-gray-800 w-full max-w-md p-6 rounded-t-lg animate-slide-up overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '80vh' }}
          >
            {renderTasksList()}
          </div>
        </div>
      )}
      {/* Задания */}
      <div className="px-4 mt-8">
        <h3 className="text-xl text-white font-bold text-center">Задания</h3>
        <p className="text-center text-gray-400 mt-2">
          Тут будут задания, за которые можно получить больше монет.
        </p>
      </div>
    </>
  );
};

export default TasksContent;
