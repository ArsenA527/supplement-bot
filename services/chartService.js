const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');
const path = require('path');

class ChartService {
  constructor() {
    this.width = 800;
    this.height = 400;
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({ width: this.width, height: this.height });
  }

  // График соблюдения режима
  async generateComplianceChart(historyData, days = 30) {
    const configuration = {
      type: 'line',
      data: {
        labels: this.generateDateLabels(days),
        datasets: [{
          label: 'Соблюдение режима (%)',
          data: this.calculateDailyCompliance(historyData, days),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          fill: false
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Процент соблюдения'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Дата'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Динамика соблюдения режима приема'
          },
          legend: {
            display: true
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  // График принятых/пропущенных приемов
  async generateIntakeChart(historyData, days = 30) {
    const dailyStats = this.calculateDailyIntakeStats(historyData, days);

    const configuration = {
      type: 'bar',
      data: {
        labels: this.generateDateLabels(days),
        datasets: [
          {
            label: '✅ Принято',
            data: dailyStats.taken,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          },
          {
            label: '⏭️ Пропущено',
            data: dailyStats.skipped,
            backgroundColor: 'rgba(255, 205, 86, 0.6)',
            borderColor: 'rgba(255, 205, 86, 1)',
            borderWidth: 1
          },
          {
            label: '❌ Не принято',
            data: dailyStats.missed,
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Количество приемов'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Дата'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Статистика приемов по дням'
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  generateDateLabels(days) {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
    }
    return labels;
  }

  calculateDailyCompliance(historyData, days) {
    const dailyStats = this.calculateDailyIntakeStats(historyData, days);
    return dailyStats.taken.map((taken, index) => {
      const total = taken + dailyStats.skipped[index] + dailyStats.missed[index];
      return total > 0 ? Math.round((taken / total) * 100) : 0;
    });
  }

  calculateDailyIntakeStats(historyData, days) {
    const taken = new Array(days).fill(0);
    const skipped = new Array(days).fill(0);
    const missed = new Array(days).fill(0);

    historyData.forEach(record => {
      const recordDate = new Date(record.taken_at);
      const today = new Date();
      const dayDiff = Math.floor((today - recordDate) / (1000 * 60 * 60 * 24));

      if (dayDiff >= 0 && dayDiff < days) {
        const index = days - 1 - dayDiff;
        if (record.status === 'taken') taken[index]++;
        else if (record.status === 'skipped') skipped[index]++;
        else if (record.status === 'missed') missed[index]++;
      }
    });

    return { taken, skipped, missed };
  }
}

module.exports = new ChartService();
