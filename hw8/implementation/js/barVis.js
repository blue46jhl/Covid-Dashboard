/* * * * * * * * * * * * * *
*      class BarVis        *
* * * * * * * * * * * * * */


class BarVis {

    constructor(parentElement, covidData, usaData, descending){
        this.parentElement = parentElement;
        this.covidData = covidData;
        this.usaData = usaData;
        this.descending = descending;

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initVis()
    }

    initVis(){
        let vis = this;

        vis.margin = {top: 20, right: 20, bottom: 60, left: 60};
        vis.width = $("#" + vis.parentElement).width() - vis.margin.left - vis.margin.right;
        vis.height = $("#" + vis.parentElement).height() - vis.margin.top - vis.margin.bottom;

        // init drawing area
        vis.svg = d3.select("#" + vis.parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append('g')
            .attr('transform', `translate (${vis.margin.left}, ${vis.margin.top})`);

        // add title
        vis.svg.append('g')
            .attr('class', 'title bar-title')
            .append('text')
            .text(function(d){
                if (vis.descending) {
                    return "Top 10 States"
                } else {
                    return "Bottom 10 States"
                }
            })
            .attr("font-weight", 500)
            .attr('transform', `translate(${vis.width * 2.8 / 5}, 10)`)
            .attr('text-anchor', 'middle');
        
        // init scales
        vis.x = d3.scaleBand().rangeRound([0, vis.width])
            .paddingInner(0.1);
        vis.y = d3.scaleLinear().range([vis.height, 0]);

        // init x & y axis
        vis.xAxisGroup = vis.svg.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", "translate(0," + vis.height + ")")
        vis.yAxisGroup = vis.svg.append("g")
            .attr("class", "axis y-axis");

        // append tooltip
        vis.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'barTooltip')

        this.wrangleData();
    }

    wrangleData(){
        let vis = this

        let selectedCategory = $('#categorySelector').val()
        // I think one could use a lot of the dataWrangling from dataTable.js here...

        // maybe a boolean in the constructor could come in handy ?

        let filteredData = [];

        // if there is a region selected
        if (selectedTimeRange.length !== 0){
            //console.log('region selected', vis.selectedTimeRange, vis.selectedTimeRange[0].getTime() )

            // iterate over all rows the csv (dataFill)
            vis.covidData.forEach( row => {
                // and push rows with proper dates into filteredData
                if (selectedTimeRange[0].getTime() <= vis.parseDate(row.submission_date).getTime() && vis.parseDate(row.submission_date).getTime() <= selectedTimeRange[1].getTime() ){
                    filteredData.push(row);
                }
            });
        } else {
            filteredData = vis.covidData;
        }

        // prepare covid data by grouping all rows by state
        let covidDataByState = Array.from(d3.group(filteredData, d =>d.state), ([key, value]) => ({key, value}))

        // have a look
        // console.log(covidDataByState)

        // init final data structure in which both data sets will be merged into
        vis.stateInfo = []

        // merge
        covidDataByState.forEach( state => {

            // get full state name
            let stateName = nameConverter.getFullName(state.key)

            // init counters
            let newCasesSum = 0;
            let newDeathsSum = 0;
            let population = 0;

            // look up population for the state in the census data set
            vis.usaData.forEach( row => {
                if(row.state === stateName){
                    population += +row["2019"].replaceAll(',', '');
                }
            })

            // calculate new cases by summing up all the entries for each state
            state.value.forEach( entry => {
                newCasesSum += +entry['new_case'];
                newDeathsSum += +entry['new_death'];
            });

            // populate the final data structure
            vis.stateInfo.push(
                {
                    state: stateName,
                    population: population,
                    absCases: newCasesSum,
                    absDeaths: newDeathsSum,
                    relCases: (newCasesSum/population*100),
                    relDeaths: (newDeathsSum/population*100)
                }
            )
        })

        // console.log(vis.stateInfo);

        if (vis.descending){
            vis.stateInfo.sort((a,b) => {return b[selectedCategory] - a[selectedCategory]})
        } else {
            vis.stateInfo.sort((a,b) => {return a[selectedCategory] - b[selectedCategory]})
        }

        // console.log('final data structure', vis.stateInfo);

        vis.topTenData = vis.stateInfo.slice(0, 10)

        console.log('final data structure', vis.topTenData);

        vis.updateVis()

    }

    updateVis(){
        let vis = this;
        let selectedCategory = $('#categorySelector').val()
        // update domains
        vis.x.domain(vis.topTenData.map(d => d.state));
        vis.y.domain([0,d3.max(vis.topTenData, (d,i) => d[selectedCategory])]);

        // draw x & y axis
        vis.xAxisGroup.transition().duration(400).call(d3.axisBottom(vis.x))
            .selectAll("text")  
            .attr("font-size", "7.5px")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
        vis.yAxisGroup.transition().duration(400).call(d3.axisLeft(vis.y))
            .selectAll("text")  
            .attr("font-size", "10px");

        // draw bars
        let bars = vis.svg.selectAll(".bar")
            .data(vis.topTenData);

        bars.exit().remove();

        bars.enter()
            .append("rect")
            .attr("class", "state bar")
            .merge(bars)
            // attempt to link hover effects
            // .attr("id", function(d) { "state" + d.state}) 
            .on('mouseover', function(event, d){
                d3.select(this)
                    .attr('stroke-width', '2px')
                    .attr('stroke', 'black')
                    .attr('fill', 'red')
                vis.tooltip
                    .style("opacity", 1)
                    .style("left", event.pageX + 10 + "px")
                    .style("top", event.pageY + "px")
                    .html(`
                        <div style="border: thin solid grey; border-radius: 5px; background: lightgrey; padding: 20px">
                            <h3>${d.state}<h3>
                            <h4> Population: ${d.population}</h4>      
                            <h4> Cases (Absolute): ${d.absCases}</h4> 
                            <h4> Deaths (Absolute): ${d.absDeaths}</h4>
                            <h4> Cases (Relative): ${d3.format(".3n")(d.relCases)}%</h4> 
                            <h4> Deaths (Relative): ${d3.format(".1n")(d.relDeaths)}% </h4>     
                        </div>`)
            })
            .on('mouseout', function(event, d){
                d3.select(this)
                    .attr('stroke-width', '2px')
                    .attr("stroke", "black")
                    .attr("fill", "teal")
   
                vis.tooltip
                    .style("opacity", 0)
                    .style("left", 0)
                    .style("top", 0)
                    .html(``);
            })
            .transition().duration(400)
            .attr("x", d => vis.x(d.state))
            .attr("y", d => vis.y(d[selectedCategory]))
            .attr("height", d => (vis.height - vis.y(d[selectedCategory])))
            .attr("width", vis.x.bandwidth())
            .attr("fill", "teal")
            .attr("opacity", .5)
    }

}
