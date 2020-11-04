/* * * * * * * * * * * * * *
*          MapVis          *
* * * * * * * * * * * * * */


class MapVis{

    // constructor method to initialize Timeline object
    constructor(parentElement, geoData, covidData, usaData) {
        this.parentElement = parentElement;
        this.geoData = geoData;
        this.covidData = covidData;
        this.usaData = usaData;
        this.displayData = [];

        // parse date method
        this.parseDate = d3.timeParse("%m/%d/%Y");

        this.initMap()
    }

    initMap(){
        let mapObject = this;
        
        mapObject.margin = {top: 20, right:20, bottom: 20, left: 20};
        mapObject.width = $("#" + mapObject.parentElement).width() - mapObject.margin.left - mapObject.margin.right;
        mapObject.height = $("#" + mapObject.parentElement).height() - mapObject.margin.top - mapObject.margin.bottom;

        // init drawing area
        mapObject.svg = d3.select("#" + mapObject.parentElement).append("svg")
            .attr("width", mapObject.width)
            .attr("height", mapObject.height)
            .attr('transform', `translate (${mapObject.margin.left}, ${mapObject.margin.top})`);

        // add title
        mapObject.svg.append('g')
            .attr('class', 'title map-title')
            .append('text')
            .text('An Interactive Map of USA')
            .attr("font-family", "Gothic")
            .attr("font-weight", 900)
            .attr("font-size", "20px")
            .attr('transform', `translate(${mapObject.width / 2}, 20)`)
            .attr('text-anchor', 'middle');

        // // define a geo generator
        mapObject.path = d3.geoPath()

        // convert TopoJSON data into GeoJSON data
        mapObject.country = topojson.feature(mapObject.geoData,mapObject.geoData.objects.states).features;

        // define viewpoint and zoom
        mapObject.viewpoint = {'width': 975, 'height': 610};
            mapObject.zoom = mapObject.width / mapObject.viewpoint.width;

        // Draw states
        mapObject.states = mapObject.svg.selectAll(".state")
            .data(mapObject.country)
            .enter().append("path")
            .attr('class', 'state map')
            .attr("d", mapObject.path)
            .style("fill", "steelblue")
            .attr("opacity", .9)
            .attr("stroke", "black")
            .attr("transform", `scale(${mapObject.zoom} ${mapObject.zoom})`)

        // define a color scale
        mapObject.colorScale = d3.scaleLinear()
            .range(["lightblue", "darkblue"])

        // // create a legend

        mapObject.defs = mapObject.svg.append("defs");
  
        // deining a linear gradient for continuous color legend
        mapObject.linearGradient = mapObject.defs.append("linearGradient")
            .attr("id", "linear-gradient");

        mapObject.linearGradient.selectAll("stop")
            .data(mapObject.colorScale.ticks().map((t, i, n) => ({ offset: `${100*i/n.length}%`, color: mapObject.colorScale(t) })))
            .enter().append("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);

        mapObject.x = d3.scaleLinear()
            .range([0,mapObject.width / 4])

        mapObject.xAxis = d3.axisBottom()
            .scale(mapObject.x)
            .tickFormat(d3.format(".2s"))

        mapObject.legend = mapObject.svg.append("g")
            .attr('class', 'legend')
            .attr('transform', `translate(${mapObject.width * 2.8 / 4}, ${mapObject.height-20})`)
            .style("fill", "url(#linear-gradient)")
            .call(mapObject.xAxis)

        
        // append tooltip
        mapObject.tooltip = d3.select("body").append('div')
            .attr('class', "tooltip")
            .attr('id', 'mapTooltip')
        mapObject.wrangleData()
    }

    wrangleData(){
        let mapObject = this

        // first, filter according to selectedTimeRange, init empty array
        let filteredData = [];

        // if there is a region selected
        if (selectedTimeRange.length !== 0){
            //console.log('region selected', vis.selectedTimeRange, vis.selectedTimeRange[0].getTime() )

            // iterate over all rows the csv (dataFill)
            mapObject.covidData.forEach( row => {
                // and push rows with proper dates into filteredData
                if (selectedTimeRange[0].getTime() <= mapObject.parseDate(row.submission_date).getTime() && mapObject.parseDate(row.submission_date).getTime() <= selectedTimeRange[1].getTime() ){
                    filteredData.push(row);
                }
            });
        } else {
            filteredData = mapObject.covidData;
        }

        // prepare covid data by grouping all rows by state
        let covidDataByState = Array.from(d3.group(filteredData, d =>d.state), ([key, value]) => ({key, value}))

        // init final data structure in which both data sets will be merged into
        mapObject.stateInfo = {}

        // merge
        covidDataByState.forEach( state => {

            // get full state name
            let stateName = nameConverter.getFullName(state.key)

            // init counters
            let newCasesSum = 0;
            let newDeathsSum = 0;
            let population = 0;

            // look up population for the state in the census data set
            mapObject.usaData.forEach( row => {
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
            mapObject.stateInfo[stateName] =
                {
                    state: stateName,
                    population: population,
                    absCases: newCasesSum,
                    absDeaths: newDeathsSum,
                    relCases: (newCasesSum/population*100),
                    relDeaths: (newDeathsSum/population*100)
                }
        })
        // log all of the data
        console.log('final data structure for myDataTable', mapObject.stateInfo);

        mapObject.updateMap()

    }

    updateMap(){
        let mapObject = this;

        let selectedCategory = $('#categorySelector').val()

        mapObject.colorScale.domain([0,d3.max(Object.entries(mapObject.stateInfo), d => d[1][selectedCategory])])
        mapObject.states
                .style("fill", function(d, index) { 
                    return mapObject.colorScale(mapObject.stateInfo[d.properties.name][selectedCategory])
                })
                .on('mouseover', function(event, d){
                    d3.select(this)
                        .attr('stroke-width', '2px')
                        .attr('stroke', 'black')
                        .style("fill", "red")
                        .attr("opacity", .5)
                    // attempt to link hover effects
                    // d3.selectAll(d=> "#" + "state" + d.properties.name)
                    //     .attr("fill", "purple")
                    mapObject.tooltip
                        .style("opacity", 1)
                        .style("left", event.pageX + 10 + "px")
                        .style("top", event.pageY + "px")
                        .html(`
                            <div style="border: thin solid grey; border-radius: 5px; background: lightgrey; padding: 20px">
                                <h3>${d.properties.name}<h3>
                                <h4> Population: ${mapObject.stateInfo[d.properties.name].population}</h4>      
                                <h4> Cases (Absolute): ${mapObject.stateInfo[d.properties.name].absCases}</h4> 
                                <h4> Deaths (Absolute): ${mapObject.stateInfo[d.properties.name].absDeaths}</h4>
                                <h4> Cases (Relative): ${d3.format(".3n")(mapObject.stateInfo[d.properties.name].relCases)}%</h4> 
                                <h4> Deaths (Relative): ${d3.format(".1n")(mapObject.stateInfo[d.properties.name].relDeaths)}% </h4>     
                            </div>`)
                })
                .on('mouseout', function(event, d){
                    d3.select(this)
                        .attr('stroke-width', '1px')
                        .attr("stroke", "black")
                        .attr("opacity", 1)
                        .style("fill", d => mapObject.colorScale(mapObject.stateInfo[d.properties.name][selectedCategory]))
       
                    mapObject.tooltip
                        .style("opacity", 0)
                        .style("left", 0)
                        .style("top", 0)
                        .html(``);
                })
        mapObject.xAxis.tickValues([0,d3.max(Object.entries(mapObject.stateInfo), d => d[1][selectedCategory])])
        mapObject.x.domain([0,d3.max(Object.entries(mapObject.stateInfo), d => d[1][selectedCategory])])

        mapObject.svg.selectAll(".legend")
            .call(mapObject.xAxis)
    }
}
