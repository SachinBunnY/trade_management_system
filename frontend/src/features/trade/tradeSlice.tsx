import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {TableData} from '../../services/util';


interface TradeState {
    tradeList: TableData[],
    isModelOpen:Record<string,any>,
    sessionToken:{[key:string]:any},
    squareOffResponse:Record<any, any>,
    manualStoplossPrice:any,
    isEditable:any,
    slModifyResponse:Record<any,any>,
    selectedClientId:any,
    isLoader:boolean,
    modelName: string[],
    selectedModelName:string,
    modelAllocation:Record<any,any>,
    totalMarginAllocated:Number
}

const initialState: TradeState = {
    tradeList:[],
    isModelOpen:{},
    sessionToken:{},
    squareOffResponse:{},
    manualStoplossPrice:null,
    isEditable:null,
    slModifyResponse:{},
    selectedClientId: localStorage.getItem('selectedClient')||'All',
    isLoader:false,
    modelName: [],
    selectedModelName: localStorage.getItem('selectedModelName')||'All',
    modelAllocation:{},
    totalMarginAllocated:0
}

const TradeSlice = createSlice({
    name:'trade',
    initialState,
    reducers:{
        setTradeList(state, action:PayloadAction<TableData[]>){
            state.tradeList = action.payload;
        },
        setIsModelOpen(state, action:PayloadAction<Record<string, any>>){
            state.isModelOpen = action.payload;
        },
        setSessionToken(state, action:PayloadAction<{[key:string]:any}>){
            state.sessionToken = action.payload;
        },
        setSquareOffResponse(state, action:PayloadAction<{}>){
            state.squareOffResponse = action.payload;
        },
        setManualStoplossPrice(state, action:PayloadAction<any>){
            state.manualStoplossPrice = action.payload;
        },
        setIsEditable(state, action:PayloadAction<any>){
            state.isEditable = action.payload;
        },
        setSLModifyResponse(state, action:PayloadAction<{}>){
            state.slModifyResponse = action.payload;
        },
        setSelectedClientId(state, action:PayloadAction<any>){
            state.selectedClientId = action.payload;
        },
        setIsLoader(state:any, action:PayloadAction<boolean>){
            state.isLoader = action.payload;
        },
        setModelName(state:any, action:PayloadAction<string[]>){
            state.modelName = action.payload;
        },
        setSelectedModelName(state:any, action:PayloadAction<string>){
            state.selectedModelName = action.payload;
        },
        setModelAllocation(state:any, action:PayloadAction<{}>){
            state.modelAllocation = action.payload;
        },
        setTotalMarginAllocated(state:any, action:PayloadAction<Number>){
            state.totalMarginAllocated = action.payload;
        }
    }
})

export const {setTradeList, setIsModelOpen, setSessionToken, setSquareOffResponse, setManualStoplossPrice,
     setIsEditable, setSLModifyResponse, setSelectedClientId, setIsLoader,setModelName,setSelectedModelName,
     setModelAllocation, setTotalMarginAllocated} = TradeSlice.actions;

export default TradeSlice.reducer;