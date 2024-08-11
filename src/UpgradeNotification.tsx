import React, { useEffect, useState } from 'react';
import './minecontent.css';

interface UpgradeNotificationProps {
  message: string;
  duration?: number;
}

const UpgradeNotification: React.FC<UpgradeNotificationProps> = ({ message, duration = 2000 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const hideTimeout = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(hideTimeout);
  }, [message, duration]);

  return (
    <div className={`upgrade-notification ${visible ? 'visible' : ''}`}>
      {message}
    </div>
  );
};

export default UpgradeNotification;