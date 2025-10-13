class TimeHelper {
  static normalizeTime(timeStr) {
    if (!timeStr) return '08:00';

    try {
      const cleanTime = timeStr.toString().trim().replace(/\s/g, '');

      if (cleanTime.match(/^\d{1,2}:\d{2}$/)) {
        const [hours, minutes] = cleanTime.split(':').map(Number);
        const normalizedHours = Math.max(0, Math.min(23, hours));
        const normalizedMinutes = Math.max(0, Math.min(59, minutes));
        return `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}`;
      }

      if (cleanTime.match(/^\d{3,4}$/)) {
        const paddedTime = cleanTime.padStart(4, '0');
        const hours = parseInt(paddedTime.slice(0, 2));
        const minutes = parseInt(paddedTime.slice(2));
        const normalizedHours = Math.max(0, Math.min(23, hours));
        const normalizedMinutes = Math.max(0, Math.min(59, minutes));
        return `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}`;
      }

      if (cleanTime.match(/^\d{1,4}$/)) {
        const timeNum = parseInt(cleanTime);
        if (timeNum < 100) {
          return `${String(timeNum).padStart(2, '0')}:00`;
        } else {
          const padded = String(timeNum).padStart(4, '0');
          const hours = parseInt(padded.slice(0, 2));
          const minutes = parseInt(padded.slice(2));
          const normalizedHours = Math.max(0, Math.min(23, hours));
          const normalizedMinutes = Math.max(0, Math.min(59, minutes));
          return `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}`;
        }
      }
    } catch (error) {
      console.error('❌ Ошибка нормализации времени:', error, timeStr);
    }

    return '08:00';
  }

  static isValidTime(timeStr) {
    try {
      const time = this.normalizeTime(timeStr);
      const [hours, minutes] = time.split(':').map(Number);
      return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
    } catch {
      return false;
    }
  }

  static compareTimes(time1, time2) {
    return this.normalizeTime(time1) === this.normalizeTime(time2);
  }

  static timeToMinutes(timeStr) {
    const time = this.normalizeTime(timeStr);
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  static minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}

module.exports = TimeHelper;
