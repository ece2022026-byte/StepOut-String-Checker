/*
 * ECharts rendering for dashboard visualizations
 */

function renderCharts(data) {
    Object.values(charts).forEach((chart) => {
        try {
            chart.dispose();
        } catch (error) {
            // Ignore stale chart instances.
        }
    });
    charts = {};

    const EC = getChartTheme();

    const pieEl = document.getElementById('pieChart');
    if (pieEl) {
        const pieChart = echarts.init(pieEl, null, { renderer: 'canvas' });
        charts.pie = pieChart;
        const pieValues = [
            { value: data.correct, name: 'Correct', itemStyle: { color: '#22d47a' } },
            { value: data.missed_count, name: 'Missed', itemStyle: { color: '#f59e0b' } },
            { value: data.extra_count, name: 'Extra', itemStyle: { color: '#38bdf8' } },
            { value: data.mismatch_count, name: 'Mismatch', itemStyle: { color: '#f43f5e' } }
        ];
        const pieTotal = pieValues.reduce((sum, datum) => sum + datum.value, 0);

        pieChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                ...EC.tooltip,
                formatter: (point) => `<b>${point.name}</b><br/>${point.value} &nbsp;(${pieTotal ? ((point.value / pieTotal) * 100).toFixed(1) : 0}%)`
            },
            legend: {
                bottom: 6,
                left: 'center',
                ...EC.legend,
                icon: 'circle',
                itemWidth: 10,
                itemHeight: 10,
                itemGap: 18
            },
            series: [{
                type: 'pie',
                radius: ['42%', '70%'],
                center: ['50%', '46%'],
                data: pieValues,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: (point) => pieTotal && (point.value / pieTotal) * 100 >= 4 ? `${((point.value / pieTotal) * 100).toFixed(1)}%` : '',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: 12
                },
                emphasis: {
                    itemStyle: { shadowBlur: 18, shadowColor: EC.pieShadow },
                    scale: true,
                    scaleSize: 6
                },
                animationType: 'scale',
                animationEasing: 'elasticOut',
                animationDuration: 900
            }]
        });

        const breakdownHtml = pieValues.map((point) => {
            const pct = pieTotal ? ((point.value / pieTotal) * 100).toFixed(1) : '0.0';
            return `<span class="mx-2"><b>${point.name}:</b> ${pct}%</span>`;
        }).join('');
        document.getElementById('pie-breakdown').innerHTML = breakdownHtml;
    }

    const barEl = document.getElementById('barChart');
    if (barEl) {
        const barChart = echarts.init(barEl, null, { renderer: 'canvas' });
        charts.bar = barChart;
        const fieldKeys = Object.keys(data.field_errors || {});
        const fieldVals = Object.values(data.field_errors || {});

        barChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                ...EC.tooltip
            },
            grid: { left: 16, right: 24, top: 24, bottom: 60, containLabel: true },
            xAxis: {
                type: 'category',
                data: fieldKeys,
                axisLabel: { color: EC.mutedColor, rotate: 40, fontSize: 11 },
                axisLine: { lineStyle: { color: EC.axisLineColor } },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: EC.mutedColor, fontSize: 11 },
                splitLine: { lineStyle: { color: EC.gridLine } }
            },
            series: [{
                type: 'bar',
                data: fieldVals,
                barMaxWidth: 44,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#ff6f8a' },
                        { offset: 1, color: '#c0374f' }
                    ]),
                    borderRadius: [6, 6, 0, 0]
                },
                emphasis: { itemStyle: { color: '#ff9aad' } },
                label: {
                    show: true,
                    position: 'top',
                    color: EC.valueLabel,
                    fontSize: 11,
                    fontWeight: 'bold'
                },
                animationDelay: (index) => index * 60
            }],
            animationEasing: 'elasticOut',
            animationDuration: 900
        });
    }

    const timelineEl = document.getElementById('timelineChart');
    if (timelineEl) {
        const timelineChart = echarts.init(timelineEl, null, { renderer: 'canvas' });
        charts.timeline = timelineChart;
        const timeline = data.timeline_chart || {};
        const timelineLabels = Array.isArray(timeline.labels) ? timeline.labels : ['0-5', '5-10', '10-15', '15-20', '20-25', '25-30'];
        const timelineValues = Array.isArray(timeline.values) && timeline.values.length === timelineLabels.length
            ? timeline.values
            : timelineLabels.map(() => 0);

        timelineChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                ...EC.tooltip,
                formatter: (points) => `<b>${points[0].name} min</b><br/>Errors: <b>${points[0].value}</b>`
            },
            grid: { left: 16, right: 24, top: 24, bottom: 48, containLabel: true },
            xAxis: {
                type: 'category',
                data: timelineLabels,
                name: 'Minutes',
                nameLocation: 'middle',
                nameGap: 32,
                nameTextStyle: { color: EC.mutedColor, fontSize: 11 },
                axisLabel: { color: EC.mutedColor, fontSize: 11 },
                axisLine: { lineStyle: { color: EC.axisLineColor } },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: EC.mutedColor, fontSize: 11 },
                splitLine: { lineStyle: { color: EC.gridLine } }
            },
            visualMap: {
                show: false,
                min: 0,
                max: Math.max(...timelineValues, 1),
                inRange: { color: ['#1e4d7b', '#0ea5e9', '#7dd3fc'] }
            },
            series: [{
                type: 'bar',
                data: timelineValues,
                barMaxWidth: 36,
                itemStyle: { borderRadius: [5, 5, 0, 0] },
                emphasis: { itemStyle: { shadowBlur: 12, shadowColor: EC.timelineShadow } },
                label: {
                    show: true,
                    position: 'top',
                    color: EC.timelineValueLabel,
                    fontSize: 10,
                    fontWeight: 'bold',
                    formatter: (point) => point.value > 0 ? point.value : ''
                },
                animationDelay: (index) => index * 50
            }],
            animationEasing: 'cubicOut',
            animationDuration: 800
        });
    }

    const attrComp = data.attribute_comparison || {};
    let attrLabels = Array.isArray(attrComp.labels) ? [...attrComp.labels] : [];
    let goldValues = Array.isArray(attrComp.gold_values) ? [...attrComp.gold_values] : [];
    let traineeValues = Array.isArray(attrComp.trainee_values) ? [...attrComp.trainee_values] : [];

    const mustShowAttrs = ['CN', 'F', 'FK', 'GK'];
    const goldMap = new Map(attrLabels.map((label, index) => [label, goldValues[index] ?? 0]));
    const traineeMap = new Map(attrLabels.map((label, index) => [label, traineeValues[index] ?? 0]));
    mustShowAttrs.forEach((attr) => {
        if (!goldMap.has(attr)) {
            attrLabels.push(attr);
            goldMap.set(attr, 0);
            traineeMap.set(attr, 0);
        }
    });
    goldValues = attrLabels.map((label) => goldMap.get(label) ?? 0);
    traineeValues = attrLabels.map((label) => traineeMap.get(label) ?? 0);
    const attrDisplayLabels = attrLabels.map((code) => attributeLabel(code));

    const attrCompEl = document.getElementById('attributeCompareChart');
    if (attrCompEl && attrLabels.length) {
        const attrCompChart = echarts.init(attrCompEl, null, { renderer: 'canvas' });
        charts.attributeComparison = attrCompChart;
        attrCompChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                ...EC.tooltip
            },
            legend: {
                top: 4,
                right: 12,
                ...EC.legend,
                data: ['Gold', 'Trainee']
            },
            grid: { left: 16, right: 16, top: 40, bottom: 80, containLabel: true },
            xAxis: {
                type: 'category',
                data: attrDisplayLabels,
                axisLabel: { color: EC.mutedColor, rotate: 60, fontSize: 10, interval: 0 },
                axisLine: { lineStyle: { color: EC.axisLineColor } },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: EC.mutedColor, fontSize: 11 },
                splitLine: { lineStyle: { color: EC.gridLine } }
            },
            series: [
                {
                    name: 'Gold',
                    type: 'bar',
                    data: goldValues,
                    barMaxWidth: 22,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#818cf8' },
                            { offset: 1, color: '#4f46e5' }
                        ]),
                        borderRadius: [4, 4, 0, 0]
                    },
                    emphasis: { itemStyle: { color: '#a5b4fc' } }
                },
                {
                    name: 'Trainee',
                    type: 'bar',
                    data: traineeValues,
                    barMaxWidth: 22,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#fbbf24' },
                            { offset: 1, color: '#d97706' }
                        ]),
                        borderRadius: [4, 4, 0, 0]
                    },
                    emphasis: { itemStyle: { color: '#fde68a' } }
                }
            ],
            animationEasing: 'elasticOut',
            animationDuration: 950
        });
    }

    const skippedParse = Number(data.trainee_count_skipped || 0);
    const skippedValid = Number(data.trainee_count_skipped_valid || 0);
    document.getElementById('attributeCompareMeta').innerHTML =
        `Counts use all parsed trainee strings. Parse-skipped: <b>${skippedParse}</b>, validation-invalid: <b>${skippedValid}</b>.`;

    const barsGrid = document.getElementById('attributeBarsGrid');
    if (barsGrid && attrLabels.length) {
        barsGrid.innerHTML = '';

        attrLabels.forEach((label, idx) => {
            const divId = `attrBar_${idx}`;
            const col = document.createElement('div');
            col.className = 'col-12 col-sm-6 col-lg-4 col-xl-3';
            col.innerHTML = `
                <div class="p-3 rounded-4 border h-100 attribute-mini-card" role="button" tabindex="0" aria-label="Open ${attributeLabel(label)} count details">
                    <div class="fw-bold mb-2 text-center" style="font-size:0.8rem;">${attributeLabel(label)}</div>
                    <div id="${divId}" style="height:190px;"></div>
                </div>
            `;
            barsGrid.appendChild(col);

            const card = col.querySelector('.attribute-mini-card');
            if (card) {
                const openDetails = () => showAttributeCountModal(label, goldValues[idx], traineeValues[idx]);
                card.addEventListener('click', openDetails);
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openDetails();
                    }
                });
            }

            const miniDiv = document.getElementById(divId);
            if (miniDiv) {
                const miniChart = echarts.init(miniDiv, null, { renderer: 'canvas' });
                charts[`attribute_${label}_${idx}`] = miniChart;
                const goldValue = goldValues[idx];
                const traineeValue = traineeValues[idx];

                miniChart.setOption({
                    backgroundColor: 'transparent',
                    tooltip: {
                        ...EC.tooltip,
                        formatter: (point) => `<b>${point.name}</b>: ${point.value}`
                    },
                    grid: { left: 10, right: 10, top: 16, bottom: 10, containLabel: true },
                    xAxis: {
                        type: 'category',
                        data: ['Gold', 'Trainee'],
                        axisLabel: { color: EC.strongAxisLabel, fontWeight: 'bold', fontSize: 12 },
                        axisLine: { show: false },
                        axisTick: { show: false }
                    },
                    yAxis: {
                        type: 'value',
                        axisLabel: { color: EC.mutedColor, fontSize: 10 },
                        splitLine: { lineStyle: { color: EC.gridLine } }
                    },
                    series: [{
                        type: 'bar',
                        data: [
                            {
                                value: goldValue,
                                itemStyle: {
                                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                        { offset: 0, color: '#818cf8' },
                                        { offset: 1, color: '#4f46e5' }
                                    ]),
                                    borderRadius: [5, 5, 0, 0]
                                }
                            },
                            {
                                value: traineeValue,
                                itemStyle: {
                                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                        { offset: 0, color: '#fbbf24' },
                                        { offset: 1, color: '#d97706' }
                                    ]),
                                    borderRadius: [5, 5, 0, 0]
                                }
                            }
                        ],
                        barMaxWidth: 40,
                        label: {
                            show: true,
                            position: 'top',
                            color: EC.miniValueLabel,
                            fontWeight: 'bold',
                            fontSize: 12,
                            formatter: (point) => point.value
                        }
                    }],
                    animationDuration: 700,
                    animationEasing: 'cubicOut',
                    animationDelay: () => idx * 30
                });
            }
        });
    } else if (barsGrid) {
        barsGrid.innerHTML = '<div class="col-12 text-center small">No attribute comparison data available.</div>';
    }

    if (window._ecResizeHandler) {
        window.removeEventListener('resize', window._ecResizeHandler);
    }
    window._ecResizeHandler = () => {
        Object.values(charts).forEach((chart) => {
            try {
                chart.resize();
            } catch (error) {
                // Ignore disposed chart instances.
            }
        });
    };
    window.addEventListener('resize', window._ecResizeHandler);
}
