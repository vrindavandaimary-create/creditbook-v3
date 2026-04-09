import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { dashAPI, categoryAPI, partyAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { fmt, avatarColor, avatarLetter } from '../utils/helpers';
